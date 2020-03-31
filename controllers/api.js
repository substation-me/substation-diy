/********************************************************************
 *
 * CONTROLLERS: api.js ///
 * 
 * Work in progress.
 *
 *******************************************************************/
var auth = require(__dirname + "/../utility/auth.js");
var jwt = require('jsonwebtoken');

module.exports = function(app, db) {
  app.get("/api/v:version/metadata", auth.validateAPIToken, function(request, response) {
    response.status(200).send({ owner: process.env.TITLE, version: request.params.version });
  });
  
  app.get("/api/v:version/token", function(request, response) {
    var users = require(__dirname + "/../models/users.js");
    if(!request.query.email || !request.query.secret || !users.isAdmin(request.query.email)) {
      response.status(401).send({ auth: false, message: 'Unauthorized.' });
    } else {
      var secrets = auth.getAPISecrets();
      var secret = secrets[request.query.email];
      console.log(request.query.secret);
      if (request.query.secret !== secret) {
        response.status(401).send({ auth: false, message: 'Unauthorized.' });
      } else {
        var token = jwt.sign({"email":request.query.email}, process.env.SECURITY_SECRET, {
          expiresIn: 300 // expires in 5 minutes
        });
        response.status(200).send({"auth":true,"token": token});
      }
    }
  });
  
  app.get("/api/v:version/login", auth.validateAPIToken, function(request, response) {
    if(!request.query.email || !request.query.redirect) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      /*
        FULL LOGIN FLOW (ISH) - DOCUMENT THIS SHIT BETTER
        1. API client requests token, uses it to request a login for a member
        2. The /login endpoint takes member email, a login message to be included
           in the login email, and a redirect URL back to teh API client
        3. The login email is sent out as usual, but with an extra parameter on 
           the button URL that includes the redirect URL from the API client
        4. The API authorizes the login, and if good generates a second nonce for the 
           email address, then passes both the email address and the nonce to
           the redirect URL specified in the original call
        5. The API client can then use it's API secret to request a new
           API token, trades the email and nonce back to the API server for
           confirmation of successful login
      */
      var mailer = require(__dirname + "/../utility/messaging.js");
      var url = require('url');
      var redirectURL = new URL(request.query.redirect);
      mailer.sendMessage(
        app,
        request.query.email,
        "Log in to " + process.env.TITLE,
        "Just click to login. You will be redirected to <u>" + redirectURL.hostname + "</u> after your login is complete.",
        "login",
        "Log in now",
        process.env.URL + "api/v" + request.params.version + "/login/finalize",
        encodeURI(request.query.redirect)
      );
      response.status(200).send({loginRequested:true});
    }
  });
  
  app.get("/api/v:version/login/finalize", function(request, response) {
    if(!request.query.email || !request.query.nonce || !request.query.redirect) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      auth.validateNonce(
        request.query.email,
        request.query.nonce,
        function(err, data) {
          if (data) {
            // TODO: CENTRALIZE NONCE GEN IN auth.js
            // we're generating a second nonce to use as verification of this request
            // the client will get the email/nonce and a true result from /api/verify 
            // will verify that it was a true request processed by substation
            var { v1: uuidv1 } = require('uuid');
            var db = require(__dirname + "/../utility/database.js");
            // quickly generate a nonce
            var nonce = uuidv1();
            // assume we need the return, so store it in db
            db.serialize(function() {
              db.run(
                'INSERT INTO Nonces (email, nonce) VALUES ("' +
                  request.query.email +
                  '","' +
                  nonce +
                  '")'
              );
            });
            response.redirect(request.query.redirect + '?substation-email=' + request.query.email + '&substation-nonce=' + nonce);
          } else {
            response.redirect(request.query.redirect + '?substation-email=' + request.query.email);
          }
        }
      );
    }
  });
  
  app.get("/api/v:version/login/verify", auth.validateAPIToken, function(request, response) {
    if(!request.query.email || !request.query.nonce) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      auth.validateNonce(
        request.query.email,
        request.query.nonce,
        function(err, data) {
          if (data) {
            response.status(200).send({message: 'Success.',login:true});
          } else {
            response.status(401).send({message: 'Unauthorized.',login:false});  
          }
        }
      );
    }
  });
  
  app.get("/api/v:version/member", auth.validateAPIToken, function(request, response) {
    var subscribers = require(__dirname + "/../models/subscribers.js");
    
    if(!request.query.email) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      // the "true" for getStatus() is an object with first name, last name, 
      // active status, and the vendor subscription id
      subscribers.getStatus(request.query.email,function(err, member) {
        if (err) {
          response.status(500).send({active: false, message: 'Error retreiving member data.'});
        } else {
          if (!member) {
            // member is not active, so we don't send anything over API
            response.status(200).send({active:false});
          } else {
            // active is set to true for any members 
            // we're sending all basic data in this reponse, but only for active members
            response.status(200).send(member);
          }
        }
      });
    }
  });
  
};
