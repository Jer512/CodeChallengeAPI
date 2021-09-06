'use strict';

var express = require('express');
var request = require('request');
var fs = require("fs");
var app = express();

const RELEASE_API_ENDPOINT = "https://www.energy.gov/sites/prod/files/2020/12/f81/code-12-15-2020.json";
const LOCAL_DATA_FILE = __dirname + "/sampledata.json";


//CloudFront is blocking the request. The data will have to be read from a file using the 'loadReleaseDataFile()' function.
function loadReleaseData() {
    return new Promise(function (resolve, reject) {
        console.log("Loading Release Data");

        //Request the release data from the API.
        request({
            url: RELEASE_API_ENDPOINT, json: true
        }, function (error, response, body) {
            //Check for an error.
            if (error) {
                let err = "loadReleaseData: " + JSON.stringify(error);
                console.log(err);

                return reject(err);
            }

            //Return the JSON data.
            if (body.releases) {
                let err = "loadReleaseData: Unable to load releases.";
                console.log(err);

                return reject(err);
            }

            return resolve(body.releases);
        });
    });
}

//Loads the data API data from file since CloudFront is blocking calls.
function loadReleaseDataFile() {
    return new Promise(function (resolve, reject) {
        fs.readFile(LOCAL_DATA_FILE, 'utf8', function (error, data) {
            //Check for an error.
            if (error) {
                let err = "loadReleaseDataFile: " + JSON.stringify(error);
                console.log(err);

                return reject(err);
            }

            //Return the JSON data.
            let body = JSON.parse(data);
            if (!body.releases) {
                let err = "loadReleaseDataFile: Unable to load releases.";
                console.log(err);

                return reject(err);
            }

            return resolve(body.releases);
        });
    });
}

function createOrMergeOrganization(releaseOrg, mergeWith) {

    //Get the licenses for the current item.
    let licenses = [];
    releaseOrg.permissions.licenses.forEach(license => {
        licenses.push(license.name);
    });

    //Find the created month.
    let createdMonth = parseInt(releaseOrg.date.created.split('-')[1]);

    //Create our new item.
    let newOrg = {
        organization: releaseOrg.organization,
        release_count: 1,
        total_labor_hours: releaseOrg.laborHours,
        all_in_production: (releaseOrg.status === "Production"),
        licenses: licenses,
        most_active_months: [createdMonth]
    };
    
    //Merge it with an existing if supplied.
    if(mergeWith) {
        mergeWith.release_count++;
        mergeWith.total_labor_hours += newOrg.total_labor_hours;
        mergeWith.licenses = [...new Set(mergeWith.licenses.concat(newOrg.licenses))].sort();
        mergeWith.most_active_months = mergeWith.most_active_months.concat(newOrg.most_active_months).sort();

        if(releaseOrg.status !== "Production") {
            mergeWith.all_in_production = false;
        }

        return mergeWith;
    }

    return newOrg;
}

function aggregateData(releaseData) {

    //Make sure we have data.
    if (!releaseData || !Array.isArray(releaseData)) {
        const err = "aggregateData: Invalid release data.";
        console.log(err);

        return Promise.reject(err);
    }

    //Loop through the releases.
    let orgData = [];
    releaseData.forEach(release => {
        const orgIdx = orgData.findIndex(o=> o.organization === release.organization);
        if(orgIdx < 0) {
            //Create the organization record and add it to the data array.
            orgData.push(createOrMergeOrganization(release))
        }
        else 
        {
            //Merge the existing organization.
            orgData[orgIdx] = createOrMergeOrganization(release, orgData[orgIdx]);
        }
    });

    //return the aggregated data.
    return Promise.resolve(orgData);
}

function calcMostActiveMonths(orgData) {

    //Make sure we have data.
    if (!orgData || !Array.isArray(orgData)) {
        const err = "calcActiveMonths: Invalid org data.";
        console.log(err);

        return Promise.reject(err);
    }

    //Loop the organizations.
    orgData.forEach(org => {
        let monthCount = [];
        let highestCount = 1;
        
        //Loop the months.
        org.most_active_months.forEach(month => {
            if(monthCount[month]) {
                monthCount[month]++;

                //If this is a new high, update the highestCount.
                if(monthCount[month] > highestCount){
                    highestCount = monthCount[month];
                }
            }
            else
            {
                monthCount[month] = 1;
            }
        });

        //Loop the counts.
        let returnList = [];
        for (let i = 0; i < 12; i++) {
            let count = monthCount[i];

            //If the count for this month is amongst the highest, add it to the return object.
            if(count === highestCount) {
                returnList.push(i);
            }
        }

        //Set the org with our new list.
        org.most_active_months = returnList;
    });

    return Promise.resolve(orgData);
}

function sortResults(orgData, field, order){

    //Make sure we have data.
    if (!orgData || !Array.isArray(orgData)) {
        const err = "calcActiveMonths: Invalid org data.";
        console.log(err);

        return Promise.reject(err);
    }

    let sorted = orgData;

    //Sort the data by "release_count".
    if(field === "release_count") {
        sorted = orgData.sort((a, b) => a.release_count - b.release_count);
    }
    //Sort the data by "total_labor_hours".
    else if(field === "total_labor_hours") {
        sorted = orgData.sort((a, b) => a.total_labor_hours - b.total_labor_hours);
    }
    //Sort the data by "organization".
    else 
    {
        sorted = orgData.sort((a, b) => a.organization.localeCompare(b.organization));
    }

    if(order === "desc"){
        sorted.reverse();
    }

    return Promise.resolve(sorted);

}

function getAPIData(sortField, sortDir) {

    //Load the date from file. (API endpoint is not accessable because of CloudFront rules)
    //loadReleaseData()

    return loadReleaseDataFile()
        //Aggregate the data.
        .then(data => aggregateData(data))

        //Calculate the most active months.
        .then(aData => calcMostActiveMonths(aData))

        //Sort the data.
        .then(aData => sortResults(aData, sortField, sortDir));

}

app.get('/organizations', function (req, res) {

    let sortField = req.query.sort;
    let sortOrder = req.query.order;

    //Return the final data.
    getAPIData(sortField, sortOrder)
        .then(aData => {
            let resp = { organizations: [] };

            //Add the data to our response.
            aData.forEach(org => {
                resp.organizations.push(org);
            })

            //Return the JSON response.
            res.type('application/json');
            res.end(JSON.stringify(resp, null, 2));

        }).catch(err => {
            console.log(err);
            res.end(JSON.stringify(err));
        });

});

app.get('/organizations.csv', function (req, res) {

    let sortField = req.query.sort;
    let sortOrder = req.query.order;

    //Return the final data.
    getAPIData(sortField, sortOrder)
        .then(aData => {

            //CSV Value Replacer.
            const replacer = (key, value) => {
                if(value === null) {
                    return '';
                }

                if(Array.isArray(value)) {
                    return value.join('|');
                }
                
                return value;
            }

            //Convert to CSV.
            let header = Object.keys(aData[0]);
            let csvData = header.join(',');
            csvData += "\r\n";            

            aData.forEach(org => {
                //Map the fields to the header.
                csvData += header.map(field => JSON.stringify(org[field], replacer)).join(',');

                //Add a new line.
                csvData += "\r\n";
            });

            //Return the CSV response.
            res.type('csv');
            res.end(csvData);

        }).catch(err => {
            console.log(err);
            res.end(JSON.stringify(err));
        });

});

app.get('/', function (req, res) {
    fs.readFile(__dirname + "/welcome.html", 'utf8', function (error, data) {
        res.type('html');
        res.end(data);
    });
});
app.get('/style.css', function (req, res) {
    fs.readFile(__dirname + "/style.css", 'utf8', function (error, data) {
        res.type('css');
        res.end(data);
    });
});

//Start the web API.
var server = app.listen(8080, function () {
    let address = server.address();
    let host = address.address;
    let port = address.port;

    console.log("Starting up Jeremy's Code Challenge API. [http://%s:%s]", host, port);
});
