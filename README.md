#lib.rtcomm.node

This repository contains the 'rtcomm' node.js Module which includes support for all of the following

1. Event monitoring of Rtcomm services.
2. Third party call control (basically the ability to initiate a 3rd party call).

##Install
Included is a package.json which enables the node module to be installed with 'npm' into node.js

First, you need to install node.js - download a version (latest ) from here:
   http://nodejs.org

Extract the downloaded file into a directory, for example:

mkdir Runtimes
cd Runtimes
tar -zxvf node_v0.10.29-darwin-x64.tar.gz
mv node_v0.10.29-darwin-x64 node

Add Runtimes/node/bin to your path.
export PATH=$PATH:Runtimes/node/bin

Change directory to your PROJECT Directory where you want to run/test the packages listed and continue with the INSTALL

##INSTALL
npm install <path to njs/> 
npm install <path to red/>

This should install all dependencies and enable the functionality.

This is intended to be pushed to Github on Wasdev.
