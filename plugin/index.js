/*
 Interesting API https://hub.arcgis.com/datasets/nga::navtex-sites/api
*/

const util = require("util")
const _ = require("lodash")
const Readline = require('@serialport/parser-readline');
const url = require('url');

var NavTexMessages = []
var SerialPort = require('serialport');
var cleaner = require('deep-cleaner');
var qs = require('querystring');
var dateTime = require('node-datetime');
var fs = require('fs');
// var messagesCacheFile = __dirname + '/public/navtex_messages_store.json';
var messages = [];
var msgid = 1;
var message = {};
var nextline = '';
var line = '';
var input = '';
var path = require('path');
var plugin = {}

module.exports = function(app, options) {
  "use strict"
  var client
  var plugin = {}
  plugin.id = "signalk-navtex-plugin"

  var unsubscribes = []

  return {
    id: "signalk-navtex-plugin",
    name: "NavTex message reader and display",
    description:
    "Signal K server plugin that reads NavTex messages from serial with a display",
    uiSchema: {
      entered: {
        items: {
          csvTable: { "ui:widget": "textarea" }
        }
      }
    },
    schema: {
      type: "object",
      title:
      "A Signal K (node) plugin to read and display NavTex messages",
      description: "This plugin reads NavTex messages from a serial port and sends them to SignalK under /resources/navtex/.",
      properties: {
        tty: {
          type: "string",
          title: "Serial port to read NavTex input from",
          default: "/dev/ttyS1"
        },
        baudrate: {
          type: "number",
          title: "Serial port baudrate",
          default: 4800
        },
        expire: {
          type: "number",
          title: "Expire messages older than (hours)",
          default: 48
        },
      },
    },

    start: function(options) {
      var text = [];
      app.debug('starting plugin')
      const messagesCacheFile = path.join(app.getDataDirPath(), 'messagesCacheFile.json')
      app.debug('Using cache file: ' + messagesCacheFile)
      let localSubscription = {
        context: '*', // Get data for all contexts
        subscribe: [{
          path: 'resources.navtex.*', // Get navtex paths
          period: 5000 // Every 5000ms
        }]
      };

      app.subscriptionmanager.subscribe(
        localSubscription,
        unsubscribes,
        subscriptionError => {
          app.error('Error:' + subscriptionError);
        },
        delta => {
          delta.updates.forEach(u => {
            // app.debug(u.values)
            NavTexMessages.push(u.values)
          });
        }
      );

      // Check for and read cache file
		  app.debug('Checking for cache file (' + messagesCacheFile + ')');
		  if (fs.existsSync(messagesCacheFile)) {
		    app.debug('Found cache file. Reading...');
		    messages  = JSON.parse(fs.readFileSync(messagesCacheFile, 'utf8'));
		    var count = 0;
		    for (const [key, value] of Object.entries(messages)) {
		      // app.debug('key: ' + key + ' received: ' + value.datetime);
		      if (value != null && typeof value['id'] != 'undefined') {
            NavTexMessages.push(value)
            sendDelta(value)
		        msgid = value['id'];
		        app.debug('Reading msgid ' + msgid);
		        count++;
		      }
		    }
		    msgid++;

        
		    app.debug('Read ' + count + ' messages from cache. Msgid now ' + msgid);
		    removeOld();
		  } else {
		    app.debug('No cache file found');
		  }

      // Setup TTY reader
      app.debug('Using TTY ' + options.tty + ' at ' + options.baudrate + ' baud')
      var tty = new SerialPort(options.tty, {
        baudRate: options.baudrate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });
      const parser = tty.pipe(new Readline({ delimiter: '\r' }))
      parser.on('data', function (data) {
        data = data.toString().trim();
        processLine(data);
      });

      // Remove old entries every hour
      setInterval(removeOld, 60*60*1000); // every hour remove older messages

			function pushDelta(app, path, value) {
        app.debug("sendDelta: " + path + ": " + JSON.stringify(value))
			  app.handleMessage(plugin.id, {
			    updates: [
			      {
			        values: [
			          {
			            path: path,
			            value: value
			          }
			        ]
			      }
			    ]
			  })
			  return
			}
			
			function processLine(line) {
			  if (line.match(/^ZCZC/i)) {
			    if (nextline == 'text') {
			      app.debug ('Missed footer apparently');
			      processFooter();
			    }
			    nextline = 'header';
			  } else {
			    if (line.match(/^NNNN/i)) {
			      nextline = 'footer';
			    }
			  }
			
			  switch(nextline) {
			    case 'header':
			      app.debug('header: Seeing new ZCZC');
			      message.id = msgid;
			      message.epoch = Date.now();
			      // var dt = dateTime.create();
			      // var dateString = new Date(dt.now());
			      // var formatted = dt.format('HhM n d');
			      // var dateString = new String(formatted);
			      // message.datetime = dateString.split("(")[0];
			      message.stationId = line.slice(5,6);
			      message.msgtype = line.slice(6,7);
			      message.msgtypenr = line.slice(7);
			      // debug('Message: ', JSON.stringify(message))
			      nextline = 'text';
			      break;
			
			    case 'text':
			      text.push(line);
			      break;
			
			    case 'footer':
			      processFooter();
			      break;
			  }
			};
			
			function processFooter () {
			  while (text[text.length - 1] == '') {
			    text.pop();
			  }
			  if (typeof message.id !== 'undefined') {
			    message.text = text;
			    messages.push(message);
			    sendDelta(message)
			    app.debug('footer: Added message id ' + msgid);
			    cacheMessages(messages, messagesCacheFile);
			    text = [];
			    message = {};
			    msgid++;
			    nextline = '';
			  }
			}
			
			function cacheMessages (data, path) {
			  try {
			    fs.writeFileSync(path, JSON.stringify(data));
			    app.debug('Cache file written');
			  } catch (err) {
			    console.error(err)
			  }
			}
			
			function removeOld () {
		    cleaner(messages);
		    var count = 1;
		    app.debug('Cleaning entries older than ' + options.expire + ' hours')
		    var now = Date.now();
		    var messages_tmp = [];
		    messages.sort(function(a, b) {
		        return (a.id - b.id);
		    });
		    for (const [key, value] of Object.entries(messages)) {
		      if (value != null) {
		        if ((now - value['epoch']) > (options.expire * 1000 * 60 * 60)) {
		          app.debug('Removing msgid ' + value['id']);
		        } else {
		          value['id'] = count;
		          messages_tmp.push(value);
		          count++;
		        }
		      } else {
		        app.debug('Skipping null');
		      }
		    }
		    msgid = count;
		    // app.debug(messages_tmp);
		    cacheMessages(messages_tmp, messagesCacheFile);
			  messages = JSON.parse(JSON.stringify(messages_tmp));
			}

			function sendDelta(message) {
        pushDelta(app,
          "resources.navtex." + message.stationId + "." + message.msgtype + "." + message.msgtypenr,
          { 
            "epoch": message.epoch,
            "text": message.text
          })
			}

    },

    registerWithRouter: function(router) {
      // Will appear here; plugins/signalk-navtex-plugin/
      app.debug("registerWithRouter")

      router.get("/messages", (req, res) => {
        res.contentType("application/json")
        res.send(JSON.stringify(NavTexMessages))
      })

      router.get("/back", (req, res) =>{
        app.debug("back")
        res.redirect('back')
      })

    },

    stop: function() {
      app.debug("Stopping")
      unsubscribes.forEach(f => f())
      // keyPaths.length = keyPaths.length - 1

      // clearInterval(pushInterval)

      // app.signalk.removeListener("delta", handleDelta)
      app.debug("Stopped")
    }
  }
}

module.exports.app = "app"
module.exports.options = "options"

