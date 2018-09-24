const cluster = require('cluster');
if (cluster.isMaster) {
  const debug = require('debug');
  const gLogger = {
    init: debug('cluster-init'),
    cluster: debug('cluster')
  };
  const os = require('os');
  const {'length': numCPUs} = os.cpus();
  gLogger.init('master start...');
  cluster.on('listening', (worker, address) => {
    gLogger.init('listening: worker ( pid', worker.process.pid, '/ id', worker.id, '); Port:', address.port);
  }).on('exit', (worker, code, signal) => {
    gLogger.cluster('worker pid', worker.process.pid, '/ id', worker.id, ' died with', code, 'and', signal);
    cluster.fork();
  });
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  require('./forward-proxy');
}
