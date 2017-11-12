const {promisify} = require('util');
const fs = require('fs');
const _ = require('underscore');
const stripJsonComments = require('strip-json-comments');

const readFile = promisify(fs.readFile);
const regex_hostport = /^([^:]+)(:([0-9]+))?$/;

_.extendOwn(exports, {
  IGNORE_FRONT_ERR: ['ECONNRESET'],
  getHostPortFromString(hostString, defaultPort){
    let host = hostString;
    let port = defaultPort;
    let result = regex_hostport.exec(hostString);
    if (result != null) {
      host = result[1];
      if (result[2] != null) {
        port = result[3];
      }
    }
    return [host, Number(port)];
  },
  async jsonLoad(filePath, replacer){
    const jsonStr = await readFile(filePath);
    return JSON.parse(stripJsonComments(jsonStr.toString()), replacer);
  }
});
