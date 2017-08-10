let xGCEWorker = null;

console.log('[Iframe] Loaded');

/*
    Worker (separate thread to avoid freezing Firefox)
*/
function createSharedworker (sPath) {
    try {
        xGCEWorker = new SharedWorker(sPath+"gce_sharedworker.js");
    }
    catch (e) {
        console.error(e);
    }

    xGCEWorker.onerror = function(e) {
        console.log('There is an error with your worker!');
        console.log(typeof(e));
        console.log(e);
        for (let sParam in e) {
            console.log(sParam);
            console.log(e.sParam);
        }
    }

    xGCEWorker.port.onmessage = function (e) {
        // https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent
        try {
            //On retransmet directement le message à la page
            console.log("[Iframe] send from Message Worker");
            window.postMessage({SharedWorker: e.data}, sPath );
        }
        catch (e) {
            console.error(e);
        }
    };

    console.log("[Iframe] [worker]");
    console.log(xGCEWorker);


    //xGCEWorker.port.start();
    //console.log("Content script [port started]");

    //xGCEWorker.port.postMessage(["init", {sExtensionPath: browser.extension.getURL("."), sOptions: "", sContext: "Firefox"}]);

    console.log("[Iframe] [worker initialzed]");

    //xGCEWorker.port.postMessage(["parse", {sText: "Vas... J’en aie mare...", sCountry: "FR", bDebug: false, bContext: false}]);
    //xGCEWorker.port.postMessage(["parseAndSpellcheck", {sText: oRequest.sText, sCountry: "FR", bDebug: false, bContext: false}]);
    //xGCEWorker.port.postMessage(["getListOfTokens", {sText: oRequest.sText}]);
    //xGCEWorker.port.postMessage(["textToTest", {sText: oRequest.sText, sCountry: "FR", bDebug: false, bContext: false}]);
    //xGCEWorker.port.postMessage(["fullTests"]);
}


var savePathExtension = '';
var savePathOrigine = '';
console.log('[Iframe] Set receivedMessageWeb');
function receivedMessageWeb (oEvent) {
    console.log('[Iframe] received:', oEvent, savePathExtension, savePathOrigine, oEvent.origin);
    //Pour être sure que ca viens bien de notre iframe ;)
    if ( !xGCEWorker && typeof oEvent.data.sPath !== "undefined" && typeof oEvent.data.sPage !== "undefined" && oEvent.data.sPage === oEvent.origin ){
        console.log('Create the Sharedworker ', oEvent.origin);
        savePathExtension = oEvent.data.sPath;
        savePathOrigine = oEvent.origin;
        //On créer le Shraredworker
        createSharedworker(savePathExtension);
        //On initialise le Shraredworker
        xGCEWorker.port.postMessage(["init", {sExtensionPath: savePathExtension, sOptions: "", sContext: "Firefox"}]);
    } else if ( xGCEWorker && savePathOrigine === oEvent.origin) {
        //Les messages reçus maintenant on un Sharedworker fonctionnel et donc si ça viens bien de la page on lui transmet
        //TODO: Fodrait établir un protocol de communication afin qu'on ne traite vraiment que les messages a transmettre util ;)
        console.log('[Iframe] exec command with Sharedworker');
        xGCEWorker.port.postMessage(oEvent.data);
        console.log('[Iframe] end send message to worker');
    }
}
window.addEventListener("message", receivedMessageWeb, false);


console.log('[Iframe] END');