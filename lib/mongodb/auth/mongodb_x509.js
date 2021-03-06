var DbCommand = require('../commands/db_command').DbCommand
  , utils = require('../utils')
  , Binary = require('bson').Binary
  , format = require('util').format;

var authenticate = function(db, username, password, options, callback) {
  var numberOfConnections = 0;
  var errorObject = null;
  var numberOfValidConnections = 0;
  var credentialsValid = false;
  
  if(options['connection'] != null) {
    //if a connection was explicitly passed on options, then we have only one...
    numberOfConnections = 1;
  } else {
    // Get the amount of connections in the pool to ensure we have authenticated all comments
    numberOfConnections = db.serverConfig.allRawConnections().length;
    options['onAll'] = true;
  }

  // Let's start the sasl process
  var command = {
      authenticate: 1
    , mechanism: 'MONGODB-X509'
    , user: username
  };

  // Grab all the connections
  var connections = options['connection'] != null ? [options['connection']] : db.serverConfig.allRawConnections();

  // Authenticate all connections
  for(var i = 0; i < numberOfConnections; i++) {
    var connection = connections[i];
    // Execute first sasl step
    db._executeQueryCommand(DbCommand.createDbCommand(db, command, {}, '$external'), {connection:connection}, function(err, result) {
      // Count down
      numberOfConnections = numberOfConnections - 1;

      // Ensure we save any error
      if(err) {
        errorObject = err;
      } else if(result.documents[0].err != null || result.documents[0].errmsg != null){
        errorObject = utils.toError(result.documents[0]);
      } else {
        credentialsValid = true;
        numberOfValidConnections = numberOfValidConnections + 1;        
      }

      // Work around the case where the number of connections are 0
      if(numberOfConnections <= 0 && typeof callback == 'function') {
        var internalCallback = callback;
        callback = null;

        if(errorObject == null && credentialsValid) {
          // We authenticated correctly save the credentials
          db.serverConfig.auth.add('MONGODB-X509', db.databaseName, username, password);
          // Return callback
          internalCallback(errorObject, true);          
        } else {
          internalCallback(errorObject, false);
        }
      }
    });
  }
}

exports.authenticate = authenticate;