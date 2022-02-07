/*
*/

const util = require("util")
const express = require("express")
const _ = require("lodash")
const fs = require("fs")
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
      required: ["messagesFilename"],

      properties: {
        messagesFilename: {
          type: "string",
          title: "File for storing NavTex messsages",
          default: "messages.json"
        }
      }
    },

    start: function(options) {
      app.debug('started plugin')

      const messagesFile = path.join(app.getDataDirPath(), options.messagesFilename)
      app.debug("Filename is " + messagesFile)
      app.debug("started")
    },

    registerWithRouter: function(router) {
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
