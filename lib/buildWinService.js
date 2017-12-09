/* eslint-disable no-console */
const {Service} = require('node-windows');
const {promisify} = require('util');
const path = require('path');
const fs = require('fs');
const _ = require('underscore');
//
const SERVICE_NAME = 'HTTPS Proxy';
const SERVER_LOG_DIR = path.resolve(__dirname, '../service-logs');
const SCRIPT_PATH = path.resolve(__dirname, '../forward-proxy-cluster.js');
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
//
_.extendOwn(exports, {
  SERVICE_NAME, SERVER_LOG_DIR, SCRIPT_PATH,
  async build(listenPort, systemProxyPort, gwlFilePath, prFilePath){
    if (!await exists(SERVER_LOG_DIR)) {
      await mkdir(SERVER_LOG_DIR);
    }
    let isReinstall = false;
    const svc = new Service({
      'name': SERVICE_NAME,
      'description': 'Web Proxy for HTTP(s) through the system proxy.',
      'script': SCRIPT_PATH,
      'abortOnError': false,
      'logpath': SERVER_LOG_DIR,
      'env': [{
        'name': 'DEBUG',
        'value': '*'
      }, {
        'name': 'PORT',
        'value': listenPort
      }, {
        'name': 'SYSTEM_PROXY_PORT',
        'value': systemProxyPort
      }, {
        'name': 'GUEST_WHITELIST',
        'value': gwlFilePath
      }, {
        'name': 'PAC_RULES',
        'value': prFilePath
      }]
    }).on('install', () => {
      console.log(` > Install ${SERVICE_NAME} (${listenPort} -> ${systemProxyPort})`);
      svc.start();
    }).on('alreadyinstalled', () => {
      console.log(` * ${SERVICE_NAME} is here`);
      svc.uninstall();
      isReinstall = true;
    }).on('invalidinstallation', () => {
      console.log(` * Fail to install ${SERVICE_NAME}`);
    }).on('start', () => {
      console.log(` > Start ${SERVICE_NAME}`);
    }).on('stop', () => {
      console.log(` > Stop ${SERVICE_NAME}`);
    }).on('uninstall', () => {
      console.log(` > Uninstall ${SERVICE_NAME}`);
      if (isReinstall) {
        isReinstall = false;
        svc.install();
      }
    });
    console.log(`Service Log at: ${SERVER_LOG_DIR}`);
    return svc;
  }
});
