/*
 Interesting API https://hub.arcgis.com/datasets/nga::navtex-sites/api
*/

const util = require("util")
const express = require("express")
const _ = require("lodash")
const path = require("path")

// var router = express()

var plugin = {}
plugin.id = "signalk-navtex-plugin"

module.exports = function(app, options) {
  "use strict"
  var client
  var plugin = {}
  plugin.id = "signalk-navtex-plugin"

  var unsubscribes = []
  var shouldStore = function(path) {
    return true
  }

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
      description: "Description here",
    },

    start: function(options) {
      app.debug('starting plugin')
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
            app.debug(u);
          });
        }
      );
    },

    registerWithRouter: function(router) {
      // Will appear here; plugins/signalk-navtex-plugin/
      app.debug("registerWithRouter")

      router.get("/messages", (req, res) => {
        res.contentType("application/json")
        var response = "Reading from " + messagesFile

        console.log(response)
        res.send(response)
      })

      router.get("/back", (req, res) =>{
        app.debug("back")
        res.redirect('back')
      })

      router.ws('/echo', function(ws, req) {
        ws.on('message', function(msg) {
          ws.send(msg);
        });
      })

    },

    stop: function() {
      app.debug("Stopping")
      unsubscribes.forEach(f => f())
      keyPaths.length = keyPaths.length - 1

      clearInterval(pushInterval)

      app.signalk.removeListener("delta", handleDelta)
      app.debug("Stopped")
    }
  }
}

module.exports.app = "app"
module.exports.options = "options"

function pushDelta(app, path, value) {
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
