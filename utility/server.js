var express = require("express");
var session = require("express-session");
var FileStore = require('session-file-store')(session);
var bodyParser = require("body-parser");
var mustacheExpress = require("mustache-express");
var cors = require('cors');
var helmet = require('helmet');

var fileStoreOptions = {
  "path":__dirname+"/../.data"
};

// instantiate express and do settings
var app = express();
app.use(
  session({
    store: new FileStore(fileStoreOptions),
    secret: process.env.SECURITY_SECRET,
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000
    }
  })
);

// http security measures
app.use(helmet());

// enable CORS for all requests
app.use(cors());

// parse every kind of request automatically
//app.use(bodyParser.json({limit: '24mb', extended: true}))
app.use(bodyParser.urlencoded({limit: '24mb', extended: true}))

// directly serve static files from the public folder
app.use(express.static(__dirname + "/../public"));
// mustache-express settings
app.engine("html", mustacheExpress()); // register .html extension
app.disable("view cache"); // <--------------------------------------------------- COMMENT OUT IN PRODUCTION
app.set("view engine", "html"); // set the engine
app.set("views", __dirname + "/../views"); // point at our views

// force SSL
function checkHttps(req, res, next) {
  // protocol check, if http, redirect to https
  if (req.get("X-Forwarded-Proto").indexOf("https") != -1) {
    return next();
  } else {
    console.log("redirecting to ssl");
    res.redirect("https://" + req.hostname + req.url);
  }
}
app.all("*", checkHttps);


module.exports = app;