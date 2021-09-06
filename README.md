# Jeremy's Code Challenge API

This project is a code challenge demonstrating a dockerized Node.js API by Jeremy Herman.


## Getting Started

These instructions will cover usage information and for my docker container 


### Prerequisities

In order to run this container you'll need docker installed.

* [Windows](https://docs.docker.com/windows/started)
* [OS X](https://docs.docker.com/mac/started/)
* [Linux](https://docs.docker.com/linux/started/)


### Usage

Build the docker image:

```shell
docker build . -t intriguedme/codechallengeapi
```

Run the docker image. You may need to update the port if 55728 is unavailable.

```shell
docker run -p 55728:8080 -d intriguedme/codechallengeapi
```

Once the docker is running, open: [http://localhost:55728](http://localhost:55728/)


## Author

* **Jeremy Herman** - [linkedin](https://www.linkedin.com/in/jeremydherman/)

* **Project Repo** - [Jer512](https://github.com/Jer512/CodeChallengeAPI/)
