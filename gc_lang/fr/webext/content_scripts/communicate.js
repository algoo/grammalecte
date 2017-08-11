

console.log('[Iframe] Loaded');
/*console.log(self);
console.log(browser);
console.log(location);
console.log(window.parent.location);*/

var sPathOrigin,
    sPathExtension = browser.extension.getURL("");

/*
    Worker (separate thread to avoid freezing Firefox)
*/
var xGCESharedWorker = xGCESharedWorker || new SharedWorker(browser.extension.getURL("gce_sharedworker.js"), {type:"classic", credentials:"omit", name:"GrammarWorker"});
var xGCEWorker = xGCESharedWorker.port;

xGCESharedWorker.onerror = function(e) {
    console.log('There is an error with your worker!');
    console.log(typeof(e));
    console.log(e);
}

xGCEWorker.onmessage = function (e) {
    // https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent
    try {
        // On retransmet directement le message à la page
        console.log("[Iframe] send from Message Worker ",sPathExtension);
        window.postMessage({SharedWorker: e.data}, sPathExtension);
    }
    catch (e) {
        console.error(e);
    }
};
xGCEWorker.start();

console.log("[Iframe] [worker]");
console.log(xGCESharedWorker);

//xGCEWorker.start();
//console.log("Content script [port started]");

xGCEWorker.postMessage(["init", {sExtensionPath: browser.extension.getURL(""), sOptions: "", sContext: "Firefox"}]);
//xGCEWorker.postMessage(["parse", {sText: "Vas... J’en aie mare...", sCountry: "FR", bDebug: false, bContext: false}]);
//xGCEWorker.postMessage(["parseAndSpellcheck", {sText: oRequest.sText, sCountry: "FR", bDebug: false, bContext: false}]);
//xGCEWorker.postMessage(["getListOfTokens", {sText: oRequest.sText}]);
//xGCEWorker.postMessage(["textToTest", {sText: oRequest.sText, sCountry: "FR", bDebug: false, bContext: false}]);
//xGCEWorker.postMessage(["fullTests"]);


console.log('[Iframe] Set receivedMessageWeb');
function receivedMessageWeb (oEvent) {
    // Pour être sûr que ça vient bien de notre iframe ;)
    if (typeof oEvent.data.sPage !== "undefined" && oEvent.data.sPage === oEvent.origin) {
        console.log('[Iframe] Create the Sharedworker ', oEvent.origin);
        sPathOrigin = oEvent.origin;
    } else if (sPathOrigin === oEvent.origin && typeof oEvent.data.SharedWorker === "undefined") {
        console.log('[Iframe] received (no SharedWorker):', oEvent, oEvent.origin);
        // Les messages reçus maintenant ont un SharedWorker fonctionnel
        // On transmet au SharedWorker uniquement si ça vient de la page web et on s’assure que ce n’est pas une réponse du SharedWorker.
        // TODO: Établir un protocole de communication afin de traiter uniquement les messages utiles
        console.log('[Iframe] exec command with SharedWorker');
        xGCEWorker.postMessage(oEvent.data);
        console.log('[Iframe] end send message to worker');
    }
}

window.addEventListener("message", receivedMessageWeb, false);

console.log('[Iframe] END');
