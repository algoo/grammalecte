// Modify page

"use strict";


function showError (e) {
    console.error(e.fileName + "\n" + e.name + "\nline: " + e.lineNumber + "\n" + e.message);
}

console.log("Content script [start]");

/*
* Pour effectuer différent action sur la page en cours
*/
function receivedMessageIframe (oEvent) {
    if ( typeof oEvent.data.SharedWorker !== "undefined" ) {
        //C'est ici que les action devront être effectuées
        console.log('[Web] received (from iframe (Sharedworker)):', oEvent);
    }    
}

/*
* Creation d'une iframe pour communiquer entre la page visitée et le Shareworker
*/
var iframe = document.createElement('iframe');
iframe.id = "GrammaFrameModule";
iframe.src = browser.extension.getURL('content_scripts/comunicate.html');
iframe.hidden = true;
iframe.onload= function() {
    console.log('[Web] Init protocol de communication');
    //var iframeContent = iframe.contentWindow;
    var iframeContent = document.getElementById("GrammaFrameModule").contentWindow;
    iframeContent.addEventListener("message", receivedMessageIframe, false);

    try {
        //La frame est chargé on envoie l'initialisation du Sharedworker
        console.log('[Web] Initialise the worker :s');
        console.log('[Web] Domaine ext: '+browser.extension.getURL(''));
        iframeContent.postMessage({sPath:browser.extension.getURL(''), sPage:location.origin.trim("/")}, browser.extension.getURL('') );
   

        //Un petit test pour débogage ;)
        console.log('[Web] Test the worker :s');
        iframeContent.postMessage(["parse", {sText: "Vas... J’en aie mare...", sCountry: "FR", bDebug: false, bContext: false}], browser.extension.getURL(''));
    }
    catch (e) {
        console.error(e);
    }
}
document.body.appendChild(iframe);


console.log('[Web] La suite des initialisations');
function wrapTextareas() {;
    let lNode = document.getElementsByTagName("textarea");
    for (let xNode of lNode) {
        createGCButton(xNode);
    }
}

function createGCButton (xActiveTextZone) {
    let xParentElement = xActiveTextZone.parentElement;
    let xGCButton = document.createElement("div");
    xGCButton.textContent = "@";
    xGCButton.title = "Grammalecte"
    xGCButton.style = "padding: 5px; color: #FFF; background-color: hsla(210, 50%, 50%, 80%); border-radius: 3px; cursor: pointer";
    xGCButton.onclick = function() {
        console.log(xActiveTextZone.value);
    };
    xParentElement.insertBefore(xGCButton, xActiveTextZone);
}

function removeEverything () {
    while (document.body.firstChild) {
        document.body.firstChild.remove();
    }
}

function change (param) {
    document.getElementById("title").setAttribute("background-color", "#809060");
    console.log("param: " + param);
    document.getElementById("title").setAttribute("background-color", "#FF0000");
}


/*
    Assign do_something() as a listener for messages from the extension.
*/


function handleMessage2 (oRequest, xSender, sendResponse) {
    console.log(`[Content script] received: ${oRequest.content}`);
    change(request.myparam);
    //browser.runtime.onMessage.removeListener(handleMessage);
    sendResponse({response: "response from content script"});
}

browser.runtime.onMessage.addListener(handleMessage2);


wrapTextareas();
