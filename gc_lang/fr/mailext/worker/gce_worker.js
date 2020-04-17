// JavaScript

// Grammar checker engine
// PromiseWorker


"use strict";

// copy/paste
// https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/PromiseWorker.jsm

importScripts("resource://gre/modules/workers/require.js");
let PromiseWorker = require("resource://gre/modules/workers/PromiseWorker.js");

// Instantiate AbstractWorker (see below).
let worker = new PromiseWorker.AbstractWorker();

worker.dispatch = function(method, args = []) {
  // Dispatch a call to method `method` with args `args`
  return self[method](...args);
};
worker.postMessage = function(...args) {
  // Post a message to the main thread
  self.postMessage(...args);
};
worker.close = function() {
  // Close the worker
  self.close();
};
worker.log = function(...args) {
  // Log (or discard) messages (optional)
  dump("Worker: " + args.join(" ") + "\n");
};

// Connect it to message port.
self.addEventListener("message", msg => worker.handleMessage(msg));

// end of copy/paste


let gc_engine = null; // module: grammar checker engine
let gc_options = null; // module: grammar checker options
let text = null; // module: text
let lexgraph_fr = null; // module: lexicographer
let helpers = null;

let oSpellChecker = null;


function loadGrammarChecker (sGCOptions="", sContext="JavaScript") {
    if (gc_engine === null) {
        try {
            gc_options = require("resource://grammalecte/fr/gc_options.js");
            gc_engine = require("resource://grammalecte/fr/gc_engine.js");
            helpers = require("resource://grammalecte/graphspell/helpers.js");
            text = require("resource://grammalecte/text.js");
            //lexgraph_fr = require("resource://grammalecte/graphspell/lexgraph_fr.js");
            gc_engine.load(sContext, "sCSS");
            oSpellChecker = gc_engine.getSpellChecker();
            if (sGCOptions !== "") {
                console.log(sGCOptions);
                gc_options.setOptions(helpers.objectToMap(JSON.parse(sGCOptions)));
            }
            // we always retrieve options from the gc_engine, for setOptions filters obsolete options
            return gc_options.getOptions().gl_toString();
        }
        catch (e) {
            console.log("# Error: " + e.fileName + "\n" + e.name + "\nline: " + e.lineNumber + "\n" + e.message);
        }
    }
}

function setDictionary (sTypeDic, sDictionary) {
    try {
        console.log("set dictionary: " + sTypeDic);
        switch (sTypeDic) {
            case "main":
                oSpellChecker.setMainDictionary(sDictionary);
                break;
            case "community":
                break;
            case "personal":
                let oJSON = JSON.parse(sDictionary);
                oSpellChecker.setPersonalDictionary(oJSON);
                break;
            default:
                console.log("[GCE worker] unknown dictionary type");
        }
    }
    catch (e) {
        console.error(e);
    }
}

function parse (sText, sCountry, bDebug, bContext) {
    let aGrammErr = gc_engine.parse(sText, sCountry, bDebug, bContext);
    return JSON.stringify(aGrammErr);
}

function parseAndSpellcheck (sText, sCountry, bDebug, bContext) {
    let aGrammErr = gc_engine.parse(sText, sCountry, bDebug, null, bContext);
    let aSpellErr = oSpellChecker.parseParagraph(sText);
    return JSON.stringify({ aGrammErr: aGrammErr, aSpellErr: aSpellErr });
}

function suggest (sWord, nSuggLimit=10) {
    let lSugg = []
    for (let aSugg of oSpellChecker.suggest(sWord, nSuggLimit)) {
        lSugg.push(...aSugg);
    }
    return lSugg.join("|");
}

function getOptions () {
    return gc_options.getOptions().gl_toString();
}

function getDefaultOptions () {
    return gc_options.getDefaultOptions().gl_toString();
}

function setOptions (sGCOptions) {
    gc_options.setOptions(helpers.objectToMap(JSON.parse(sGCOptions)));
    return gc_options.getOptions().gl_toString();
}

function setOption (sOptName, bValue) {
    gc_options.setOptions(new Map([ [sOptName, bValue] ]));
    return gc_options.getOptions().gl_toString();
}

function resetOptions () {
    gc_options.resetOptions();
    return gc_options.getOptions().gl_toString();
}

function fullTests (sGCOptions="") {
    if (!gc_engine || !oSpellChecker || !gc_options) {
        return "# Error: grammar checker or dictionary not loaded."
    }
    let dMemoOptions = gc_options.getOptions();
    if (sGCOptions) {
        gc_options.setOptions(helpers.objectToMap(JSON.parse(sGCOptions)));
    }
    let tests = require("resource://grammalecte/tests.js");
    let oTest = new tests.TestGrammarChecking(gc_engine, gc_options);
    let sAllRes = "";
    for (let sRes of oTest.testParse()) {
        console.log(sRes+"\n");
        sAllRes += sRes+"\n";
    }
    gc_options.setOptions(dMemoOptions);
    return sAllRes;
}
