// Modify page

"use strict";


function showError (e) {
    console.error(e.fileName + "\n" + e.name + "\nline: " + e.lineNumber + "\n" + e.message);
}

console.log("Content script [start]");

/*
* Pour effectuer différent action sur la page en cours
*/
function receivedMessageFromIframe (oEvent) {
    if (typeof oEvent.data.SharedWorker !== "undefined") {
        console.log('[Web] received (from iframe (Sharedworker)):', oEvent);
        let [sCommand, answer] = oEvent.data.SharedWorker;
        console.log(sCommand);
        switch (sCommand) {
            case "grammar_errors":
                console.log(answer.aGrammErr);
                for (let oErr of answer.aGrammErr) {
                    console.log(oErr);
                }
                break;
        }
    }
}

/*
* Creation d'une iframe pour communiquer entre la page visitée et le Shareworker
*/
var sFrameID = browser.extension.getURL("").split('/')[2];
var xIframe = document.createElement('iframe');
let xFrameContent = null;
xIframe.id = sFrameID;
xIframe.src = browser.extension.getURL('content_scripts/communicate.html');
xIframe.hidden = true;
xIframe.onload= function () {
    console.log('[Web] Init protocol de communication');
    //var xFrameContent = xIframe.contentWindow;
    xFrameContent = document.getElementById(sFrameID).contentWindow;
    xFrameContent.addEventListener("message", receivedMessageFromIframe, false);
    try {
        //La frame est chargé on envoie l'initialisation du Sharedworker
        console.log('[Web] Initialise the worker :s');
        console.log('[Web] Domaine ext: '+browser.extension.getURL(""));
        xFrameContent.postMessage({sPath: browser.extension.getURL(""), sPage: location.origin.trim("/")}, browser.extension.getURL(""));
        //Un petit test pour débogage ;)
        console.log('[Web] Test the worker :s');
        xFrameContent.postMessage(["parse", {sText: "Vas... J’en aie mare...", sCountry: "FR", bDebug: false, bContext: false}], browser.extension.getURL(""));
        //Un test qui envoie a tout le monde
        xFrameContent.postMessage(["all", {}], browser.extension.getURL(""));
        //Un test qui envoie aux autres
        xFrameContent.postMessage(["other", {}], browser.extension.getURL(""));
    }
    catch (e) {
        console.error(e);
    }
}
document.body.appendChild(xIframe);


function loadImage (sContainerClass, sImagePath) {
    let xRequest;
    xRequest = new XMLHttpRequest();
    xRequest.open('GET', browser.extension.getURL("")+sImagePath, false);
    xRequest.responseType = "arraybuffer";
    xRequest.send();
    let blobTxt = new Blob([xRequest.response], {type: 'image/png'});
    let img = document.createElement('img');
    img.src = (URL || webkitURL).createObjectURL(blobTxt);
    Array.filter(document.getElementsByClassName(sContainerClass), function (oElem) {
        oElem.appendChild(img);
    });
}


console.log('[Web] La suite des initialisations');

let nWrapper = 0;
let xConjPanel = null;
let xTFPanel = null;
let xLxgPanel = null;
let xGCPanel = null;

function wrapTextareas () {
    let lNode = document.getElementsByTagName("textarea");
    for (let xNode of lNode) {
        createWrapper(xNode);
    }
}

function createWrapper (xTextArea) {
    try {
        let xParentElement = xTextArea.parentElement;
        let xWrapper = document.createElement("div");
        xWrapper.style = "padding: 5px; color: hsl(210, 10%, 90%); background-color: hsl(210, 50%, 50%); border-radius: 3px;";
        xWrapper.id = nWrapper + 1;
        nWrapper += 1;
        xParentElement.insertBefore(xWrapper, xTextArea);
        xWrapper.appendChild(xTextArea); // move textarea in wrapper
        let xToolbar = createWrapperToolbar(xTextArea);
        xWrapper.appendChild(xToolbar);
        loadImage("GrammalecteTitle", "img/logo-16.png");
    }
    catch (e) {
        showError(e);
    }
}


let sButtonStyle = "display: inline-block; padding: 0 5px; margin-left: 5px; background-color: hsl(210, 50%, 60%); border-radius: 2px; cursor: pointer;";

function createWrapperToolbar (xTextArea) {
    try {
        let xToolbar = document.createElement("div");
        xToolbar.style = "display: flex; justify-content: flex-end; margin-top: 5px; padding: 5px 10px;";
        /*let xLogo = document.createElement("img");
        xLogo.src = browser.extension.getURL("img/logo-16.png");
        xTitle.appendChild(xLogo);*/

        let xImage = document.createElement("span");
        xImage.className = "GrammalecteTitle";
        xToolbar.appendChild(xImage);

        xToolbar.appendChild(document.createTextNode("Grammalecte"));
        let xConjButton = document.createElement("div");
        xConjButton.textContent = "Conjuguer";
        xConjButton.style = sButtonStyle;
        xConjButton.onclick = function() {
            createConjPanel();
        };
        xToolbar.appendChild(xConjButton);
        let xTFButton = document.createElement("div");
        xTFButton.textContent = "Formater";
        xTFButton.style = sButtonStyle;
        xTFButton.onclick = function() {
            createTFPanel(xTextArea);
        };
        xToolbar.appendChild(xTFButton);
        let xLxgButton = document.createElement("div");
        xLxgButton.textContent = "Analyser";
        xLxgButton.style = sButtonStyle;
        xLxgButton.onclick = function() {
            createLxgPanel(xTextArea);
        };
        xToolbar.appendChild(xLxgButton);
        let xGCButton = document.createElement("div");
        xGCButton.textContent = "Corriger";
        xGCButton.style = sButtonStyle;
        xGCButton.onclick = function() {
            createGCPanel(xTextArea);
        };
        xToolbar.appendChild(xGCButton);
        return xToolbar;
    }
    catch (e) {
        showError(e);
    }
}


function createConjPanel () {
    console.log("Conjugueur");
    if (xConjPanel !== null) {
        xConjPanel.style.display = "block";
    } else {
        // create the panel
        xConjPanel = document.createElement("div");
        xConjPanel.style = "position: fixed; left: 50%; top: 50%; z-index: 100; height: 400px; margin-top: -200px; width: 600px; margin-left: -300px; border-radius: 10px;"
                         + " color: hsl(210, 10%, 4%); background-color: hsl(210, 20%, 90%); border: 10px solid hsla(210, 20%, 70%, .5);";
        xConjPanel.textContent = "Conjugueur";
        xConjPanel.setAttribute("draggable", true);
        xConjPanel.appendChild(createCloseButton(xConjPanel));
        document.body.appendChild(xConjPanel);
    }
}



function createTFPanel (xTextArea) {
    console.log("Formateur de texte");
}

function createLxgPanel (xTextArea) {
    console.log("Analyse");
}

function createGCPanel (xTextArea) {
    console.log("Correction grammaticale");
    xFrameContent.postMessage(["parse", {sText: xTextArea.value, sCountry: "FR", bDebug: false, bContext: false}], browser.extension.getURL(""));
}

function createCloseButton (xParentNode) {
    let xButton = document.createElement("div");
    xButton.style = "float: right; width: 20px; padding: 5px 10px; color: hsl(210, 0%, 100%); text-align: center;"
                  + "font-size: 20px; font-weight: bold; background-color: hsl(0, 80%, 50%); border-radius: 0 0 0 3px; cursor: pointer;";
    xButton.textContent = "×";
    xButton.onclick = function () {
        xParentNode.style.display = "none";
    }
    return xButton;
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
