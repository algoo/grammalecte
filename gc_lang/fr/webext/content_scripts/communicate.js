let xGCEWorker = null;

console.log('[Iframe] Loaded');

/*
    Worker (separate thread to avoid freezing Firefox)
*/
function createSharedWorker (sPath) {
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
    }

    xGCEWorker.port.onmessage = function (e) {
        // https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent
        try {
            // On retransmet directement le message à la page
            console.log("[Iframe] send from Message Worker");
            window.postMessage({SharedWorker: e.data}, sPath);
        }
        catch (e) {
            console.error(e);
        }
    };
    xGCEWorker.port.start();

    console.log("[Iframe] [worker]");
    console.log(xGCEWorker);

    //xGCEWorker.port.start();
    //console.log("Content script [port started]");

    xGCEWorker.port.postMessage(["init", {sExtensionPath: sPath, sOptions: "", sContext: "Firefox"}]);
    //xGCEWorker.port.postMessage(["parse", {sText: "Vas... J’en aie mare...", sCountry: "FR", bDebug: false, bContext: false}]);
    //xGCEWorker.port.postMessage(["parseAndSpellcheck", {sText: oRequest.sText, sCountry: "FR", bDebug: false, bContext: false}]);
    //xGCEWorker.port.postMessage(["getListOfTokens", {sText: oRequest.sText}]);
    //xGCEWorker.port.postMessage(["textToTest", {sText: oRequest.sText, sCountry: "FR", bDebug: false, bContext: false}]);
    //xGCEWorker.port.postMessage(["fullTests"]);
}


var sPathOrigin = '';
console.log('[Iframe] Set receivedMessageWeb');
function receivedMessageWeb (oEvent) {
    // Pour être sûr que ça vient bien de notre iframe ;)
    if (!xGCEWorker && typeof oEvent.data.sPath !== "undefined" && typeof oEvent.data.sPage !== "undefined" && oEvent.data.sPage === oEvent.origin) {
        console.log('[Iframe] Create the Sharedworker ', oEvent.origin);
        sPathOrigin = oEvent.origin;
        createSharedWorker(oEvent.data.sPath);
    } else if (xGCEWorker && sPathOrigin === oEvent.origin && typeof oEvent.data.SharedWorker === "undefined") {
        console.log('[Iframe] received (no SharedWorker):', oEvent, oEvent.origin);
        // Les messages reçus maintenant ont un SharedWorker fonctionnel
        // On transmet au SharedWorker uniquement si ça vient de la page web et on s’assure que ce n’est pas une réponse du SharedWorker.
        // TODO: Établir un protocole de communication afin de traiter uniquement les messages utiles
        console.log('[Iframe] exec command with SharedWorker');
        xGCEWorker.port.postMessage(oEvent.data);
        console.log('[Iframe] end send message to worker');
    }
}

window.addEventListener("message", receivedMessageWeb, false);

console.log('[Iframe] END');
