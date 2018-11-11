// Modify page

/* jshint esversion:6, -W097 */
/* jslint esversion:6 */
/* global GrammalectePanel, GrammalecteMenu, GrammalecteTextFormatter, GrammalecteLexicographer, GrammalecteGrammarChecker, GrammalecteMessageBox, showError, MutationObserver, chrome, document, console */

/*
    JS sucks (again, and again, and again, and again…)
    Not possible to load content from within the extension:
    https://bugzilla.mozilla.org/show_bug.cgi?id=1267027
    No SharedWorker, no images allowed for now…
*/

"use strict";

function showError (e) {
    // because console can’t display error objects from content script
    console.error(e.fileName + "\n" + e.name + "\nline: " + e.lineNumber + "\n" + e.message);
}

// Chrome don’t follow the W3C specification:
// https://browserext.github.io/browserext/
let bChrome = false;
if (typeof browser !== "object") {
    var browser = chrome;
    bChrome = true;
}

/*
function loadImage (sContainerClass, sImagePath) {
    let xRequest = new XMLHttpRequest();
    xRequest.open('GET', browser.extension.getURL("")+sImagePath, false);
    xRequest.responseType = "arraybuffer";
    xRequest.send();
    let blobTxt = new Blob([xRequest.response], {type: 'image/png'});
    let img = document.createElement('img');
    img.src = (URL || webkitURL).createObjectURL(blobTxt); // webkitURL is obsolete: https://bugs.webkit.org/show_bug.cgi?id=167518
    Array.filter(document.getElementsByClassName(sContainerClass), function (oElem) {
        oElem.appendChild(img);
    });
}
*/

let oTinyAdd = {};

const oGrammalecte = {
    nMenu: 0,
    lMenu: [],

    oTFPanel: null,
    oLxgPanel: null,
    oGCPanel: null,

    oMessageBox: null,

    xRightClickedNode: null,

    xObserver: null,

    sExtensionUrl: null,

    listenRightClick: function () {
        // Node where a right click is done
        // Bug report: https://bugzilla.mozilla.org/show_bug.cgi?id=1325814
        document.addEventListener(
            "contextmenu",
            function (xEvent) {
                this.xRightClickedNode = xEvent.target;
            }.bind(this),
            true
        );
    },

    clearRightClickedNode: function () {
        this.xRightClickedNode = null;
    },

    createMenus: function () {
        if (bChrome) {
            browser.storage.local.get("ui_options", this._createMenus.bind(this));
            return;
        }
        browser.storage.local.get("ui_options").then(this._createMenus.bind(this), showError);
    },

    _createMenus: function (dOptions) {
        if (dOptions.hasOwnProperty("ui_options")) {
            dOptions = dOptions.ui_options;
            if (dOptions.textarea) {
                for (let xNode of document.getElementsByTagName("textarea")) {
                    if (xNode.style.display !== "none" && xNode.style.visibility !== "hidden" && xNode.getAttribute("spellcheck") !== "false") {
                        this.lMenu.push(new GrammalecteMenu(this.nMenu, xNode));
                        this.nMenu += 1;
                    }
                }
            }
            if (dOptions.editablenode) {
                for (let xNode of document.querySelectorAll("[contenteditable]")) {
                    this.lMenu.push(new GrammalecteMenu(this.nMenu, xNode));
                    this.nMenu += 1;
                }
            }
        }
    },

    observePage: function () {
        /*
            When a textarea is added via jascript we add the menu :)
        */
        function NodeTinyMCE (xNode) {
            let parentNode = xNode.parentNode; //mutation.target
            if (
                typeof xNode !== "undefined" &&
                typeof xNode.id !== "undefined" &&
                typeof oTinyAdd[xNode.id] === "undefined" &&
                (parentNode.classList.contains("mce-edit-area") || parentNode.classList.contains("mceIframeContainer"))
            ) {
                //console.log(oTinyAdd, xNode, parentNode, parentNode.classList);
                oTinyAdd[xNode.id] = true;
                sendToWebpage({ tiny: xNode.id.replace("_ifr", "") });
            }
        }
        this.xObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    let MutationNode = mutation.addedNodes[i];
                    let tagName = MutationNode.tagName;

                    if (tagName == "TEXTAREA") {
                        oGrammalecte.lMenu.push(new GrammalecteMenu(oGrammalecte.nMenu, MutationNode));
                        oGrammalecte.nMenu += 1;
                    } else if (tagName == "IFRAME") {
                        NodeTinyMCE(MutationNode);
                    } else if ((tagName == "DIV" || tagName == "SPAN") && MutationNode.hasAttribute && MutationNode.hasAttribute("contenteditable")) {
                        oGrammalecte.lMenu.push(new GrammalecteMenu(oGrammalecte.nMenu, MutationNode));
                        oGrammalecte.nMenu += 1;
                    } else if (MutationNode.getElementsByTagName) {
                        for (let xNode of MutationNode.getElementsByTagName("textarea")) {
                            oGrammalecte.lMenu.push(new GrammalecteMenu(oGrammalecte.nMenu, xNode));
                            oGrammalecte.nMenu += 1;
                        }
                        for (let xNode of MutationNode.getElementsByTagName("div")) {
                            if (xNode.hasAttribute && xNode.hasAttribute("contenteditable")){
                                oGrammalecte.lMenu.push(new GrammalecteMenu(oGrammalecte.nMenu, xNode));
                                oGrammalecte.nMenu += 1;
                            }
                        }
                        for (let xNode of MutationNode.getElementsByTagName("span")) {
                            if (xNode.hasAttribute && xNode.hasAttribute("contenteditable")){
                                oGrammalecte.lMenu.push(new GrammalecteMenu(oGrammalecte.nMenu, xNode));
                                oGrammalecte.nMenu += 1;
                            }
                        }
                        for (let xNode of MutationNode.getElementsByTagName("iframe")) {
                            NodeTinyMCE(xNode);
                        }
                    }
                }
            });
        });
        this.xObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    rescanPage: function() {
        if (this.oTFPanel !== null) {
            this.oTFPanel.hide();
        }
        if (this.oLxgPanel !== null) {
            this.oLxgPanel.hide();
        }
        if (this.oGCPanel !== null) {
            this.oGCPanel.hide();
        }
        for (let oMenu of this.lMenu) {
            oMenu.deleteNodes();
        }
        this.lMenu.length = 0; // to clear an array
        this.listenRightClick();
        this.createMenus();
    },

    createTFPanel: function() {
        if (this.oTFPanel === null) {
            this.oTFPanel = new GrammalecteTextFormatter("grammalecte_tf_panel", "Formateur de texte", 760, 615, false);
            //this.oTFPanel.logInnerHTML();
            this.oTFPanel.insertIntoPage();
            window.setTimeout(
                function(self) {
                    self.oTFPanel.adjustHeight();
                },
                50,
                this
            );
        }
    },

    createLxgPanel: function () {
        if (this.oLxgPanel === null) {
            this.oLxgPanel = new GrammalecteLexicographer("grammalecte_lxg_panel", "Lexicographe", 500, 700);
            this.oLxgPanel.insertIntoPage();
        }
    },

    createGCPanel: function () {
        if (this.oGCPanel === null) {
            this.oGCPanel = new GrammalecteGrammarChecker("grammalecte_gc_panel", "Grammalecte", 500, 700);
            this.oGCPanel.insertIntoPage();
        }
    },

    createMessageBox: function () {
        if (this.oMessageBox === null) {
            this.oMessageBox = new GrammalecteMessageBox("grammalecte_message_box", "Grammalecte");
            this.oMessageBox.insertIntoPage();
        }
    },

    startGCPanel: function (xNode=null) {
        this.createGCPanel();
        this.oGCPanel.clear();
        this.oGCPanel.show();
        this.oGCPanel.start(xNode);
        this.oGCPanel.startWaitIcon();
    },

    startLxgPanel: function() {
        this.createLxgPanel();
        this.oLxgPanel.clear();
        this.oLxgPanel.show();
        this.oLxgPanel.startWaitIcon();
    },

    startFTPanel: function (xNode = null) {
        this.createTFPanel();
        this.oTFPanel.start(xNode);
        this.oTFPanel.show();
    },

    showMessage: function (sMessage) {
        this.createMessageBox();
        this.oMessageBox.show();
        this.oMessageBox.setMessage(sMessage);
    },

    getPageText: function () {
        let sPageText = document.body.innerText;
        let nPos = sPageText.indexOf("__grammalecte_panel__");
        if (nPos >= 0) {
            sPageText = sPageText.slice(0, nPos);
        }
        return sPageText;
    },

    createNode: function(sType, oAttr, oDataset=null) {
        try {
            let xNode = document.createElement(sType);
            Object.assign(xNode, oAttr);
            if (oDataset) {
                Object.assign(xNode.dataset, oDataset);
            }
            return xNode;
        } catch (e) {
            showError(e);
        }
    },

    createStyle: function (sLinkCss, sLinkId=null, xNodeToAppendTo=null) {
        try {
            let xNode = document.createElement("link");
            Object.assign(xNode, {
                rel: "stylesheet",
                type: "text/css",
                media: "all",
                href: this.sExtensionUrl + sLinkCss
            });
            if (sLinkId) {
                Object.assign(xNode, { id: sLinkId });
            }
            if (xNodeToAppendTo) {
                xNodeToAppendTo.appendChild(xNode);
            }
            return xNode;
        } catch (e) {
            showError(e);
        }
    }
};

/*
    Connexion to the background
*/
let xGrammalectePort = browser.runtime.connect({ name: "content-script port" });

xGrammalectePort.onMessage.addListener(function (oMessage) {
    let { sActionDone, result, dInfo, bEnd, bError } = oMessage;
    let sText = "";
    switch (sActionDone) {
        case "init":
            oGrammalecte.sExtensionUrl = oMessage.sUrl;
            // Start
            oGrammalecte.listenRightClick();
            oGrammalecte.createMenus();
            oGrammalecte.observePage();
            break;
        case "parseAndSpellcheck":
            if (!bEnd) {
                oGrammalecte.oGCPanel.addParagraphResult(result);
            } else {
                oGrammalecte.oGCPanel.stopWaitIcon();
            }
            break;
        case "parseAndSpellcheck1":
            oGrammalecte.oGCPanel.refreshParagraph(dInfo.sParagraphId, result);
            break;
        case "getListOfTokens":
            if (!bEnd) {
                oGrammalecte.oLxgPanel.addListOfTokens(result);
            } else {
                oGrammalecte.oLxgPanel.stopWaitIcon();
            }
            break;
        case "getSpellSuggestions":
            oGrammalecte.oGCPanel.oTooltip.setSpellSuggestionsFor(result.sWord, result.aSugg, result.iSuggBlock, dInfo.sErrorId);
            break;
        /*
            Commands received from the context menu
            (Context menu are initialized in background)
        */
        // Grammar checker commands
        case "rightClickGCEditableNode":
            if (oGrammalecte.xRightClickedNode !== null) {
                oGrammalecte.startGCPanel(oGrammalecte.xRightClickedNode);
                sText = oGrammalecte.xRightClickedNode.tagName == "TEXTAREA" ? oGrammalecte.xRightClickedNode.value : oGrammalecte.xRightClickedNode.innerText;
                xGrammalectePort.postMessage({
                    sCommand: "parseAndSpellcheck",
                    dParam: { sText: sText, sCountry: "FR", bDebug: false, bContext: false },
                    dInfo: { sTextAreaId: oGrammalecte.xRightClickedNode.id }
                });
            } else {
                oGrammalecte.showMessage(
                    "Erreur. Le node sur lequel vous avez cliqué n’a pas pu être identifié. Sélectionnez le texte à corriger et relancez le correcteur via le menu contextuel."
                );
            }
            break;
        case "rightClickGCPage":
            oGrammalecte.startGCPanel();
            xGrammalectePort.postMessage({
                sCommand: "parseAndSpellcheck",
                dParam: { sText: oGrammalecte.getPageText(), sCountry: "FR", bDebug: false, bContext: false },
                dInfo: {}
            });
            break;
        case "rightClickGCSelectedText":
            oGrammalecte.startGCPanel();
            // selected text is sent to the GC worker in the background script.
            break;
        // Lexicographer commands
        case "rightClickLxgEditableNode":
            if (oGrammalecte.xRightClickedNode !== null) {
                oGrammalecte.startLxgPanel();
                sText = oGrammalecte.xRightClickedNode.tagName == "TEXTAREA" ? oGrammalecte.xRightClickedNode.value : oGrammalecte.xRightClickedNode.innerText;
                xGrammalectePort.postMessage({
                    sCommand: "getListOfTokens",
                    dParam: { sText: sText },
                    dInfo: { sTextAreaId: oGrammalecte.xRightClickedNode.id }
                });
            } else {
                oGrammalecte.showMessage(
                    "Erreur. Le node sur lequel vous avez cliqué n’a pas pu être identifié. Sélectionnez le texte à analyser et relancez le lexicographe via le menu contextuel."
                );
            }
            break;
        case "rightClickLxgPage":
            oGrammalecte.startLxgPanel();
            xGrammalectePort.postMessage({
                sCommand: "getListOfTokens",
                dParam: { sText: oGrammalecte.getPageText() },
                dInfo: {}
            });
            break;
        case "rightClickLxgSelectedText":
            oGrammalecte.startLxgPanel();
            // selected text is sent to the GC worker in the background script.
            break;
        // Text formatter command
        case "rightClickTFEditableNode":
            if (oGrammalecte.xRightClickedNode !== null) {
                if (oGrammalecte.xRightClickedNode.tagName == "TEXTAREA") {
                    oGrammalecte.startFTPanel(oGrammalecte.xRightClickedNode);
                } else {
                    oGrammalecte.showMessage(
                        "Cette zone de texte n’est pas réellement un champ de formulaire, mais un node HTML éditable. Le formateur de texte n’est pas disponible pour ce type de champ de saisie."
                    );
                }
            } else {
                oGrammalecte.showMessage("Erreur. Le node sur lequel vous avez cliqué n’a pas pu être identifié.");
            }
            break;
        // rescan page command
        case "rescanPage":
            oGrammalecte.rescanPage();
            break;
        default:
            console.log("[Content script] Unknown command: " + sActionDone);
    }
});


/*
    Communicate webpage script <=> WebExtension
    La méthode d’injection de ce script est importante !

    Pour que la page web puisse envoyer des infos au background
    Page web => Script injecté => Content script => Background
    Pour la réponse, ce sont les mêmes étapes en sens inverse.
*/
let xScriptNode = document.createElement("script");
xScriptNode.src = browser.extension.getURL("content_scripts/event.js");
document.documentElement.appendChild(xScriptNode);

let nMin = Math.ceil(0);
let nMax = Math.floor(9999999);
function uniqueID () {
    return Date.now().toString(36) + "-" + (Math.floor(Math.random() * (nMax - nMin)) + nMin).toString(36);
}

// ! Écoute des messages venant du script injecté
document.addEventListener("GrammalecteEvent", function (event) {
    let oActionFromPage = JSON.parse(event.detail);
    //console.log(event);
    let sText = false;
    let dInfo = {};
    let xNodeToParse = null;

    if (oActionFromPage.iframe) {
        xNodeToParse = document.getElementById(oActionFromPage.iframe).contentWindow.document.body;
    }
    if (oActionFromPage.elm) {
        xNodeToParse = document.getElementById(oActionFromPage.elm);
        sText = xNodeToParse.tagName == "TEXTAREA" ? xNodeToParse.value : xNodeToParse.innerText;
        dInfo = { sTextAreaId: xNodeToParse.id };
    }
    if (oActionFromPage.sTextToParse) {
        oGrammalecte.startGCPanel(xNodeToParse);
        xGrammalectePort.postMessage({
            sCommand: "parseAndSpellcheck",
            dParam: { sText: sText || oActionFromPage.sTextToParse, sCountry: "FR", bDebug: false, bContext: false },
            dInfo: dInfo
        });
    }
    if (oActionFromPage.sTextForLexicographer) {
        oGrammalecte.startLxgPanel();
        xGrammalectePort.postMessage({
            sCommand: "getListOfTokens",
            dParam: { sText: sText || oActionFromPage.sTextForLexicographer },
            dInfo: dInfo
        });
    }
});

let bInjectedScriptReady = false;
let lBufferMsg = [];

// ! Permet d’envoyer des messages vers le script injecté
// (peut aussi être lu par un script sur la page web)
function sendToWebpage (oDataAction) {
    let oDataToSend = oDataAction;
    if (typeof oDataToSend.IdAction === "undefined") {
        oDataToSend.IdAction = uniqueID();
    }
    if (oDataAction.elm) {
        if (!oDataAction.elm.id) {
            oDataAction.elm.id = uniqueID();
        }
        oDataToSend.elm = oDataAction.elm.id;
    }

    if (!bInjectedScriptReady) {
        lBufferMsg.push(oDataToSend);
    } else {
        //console.log('sendToWebpage', oDataToSend);
        let eventGrammalecte = new CustomEvent("GrammalecteToPage", { detail: JSON.stringify(oDataToSend) });
        document.dispatchEvent(eventGrammalecte);
    }

    return oDataToSend.IdAction;
}

// ! Les messages ne peuvent être envoyés qu’après l’injection du script
document.addEventListener("GLInjectedScriptIsReady", function () {
    //console.log("GLInjectedScriptIsReady EXT");
    bInjectedScriptReady = true;
    if (lBufferMsg.length > 0) {
        for (const oDataToSend of lBufferMsg) {
            let eventGrammalecte = new CustomEvent("GrammalecteToPage", { detail: JSON.stringify(oDataToSend) });
            document.dispatchEvent(eventGrammalecte);
        }
    }
});

sendToWebpage({ init: browser.extension.getURL("") });
