// Injected script into web page

"use strict";


function uniqueID () {
    let nMin = Math.ceil(0);
    let nMax = Math.floor(9999999);
    return Date.now().toString(36) + "-" + (Math.floor(Math.random() * (nMax - nMin)) + nMin).toString(36);
}

// ! Ecoute des messages venant du content-script
let sBrowserURL;
document.addEventListener("GrammalecteToPage", function respListener (event) {
    //console.log(event);
    let oData = JSON.parse(event.detail);
    // Message envoyer dès que le script est injecté
    if (typeof oData.init !== "undefined") {
        sBrowserURL = oData.init;
    }
    if (typeof oData.tiny !== "undefined") {
        //console.log('Detect Tiny', oData.tiny);
        TinyIDInPage(oData.tiny);
    }
    //console.log("GrammalecteToPage", oData);
});

// ! Permet d'envoyer des message vers le content script
// Retourne un identifiant unique au cas ou si besoin
// La ID unique peut être util si on permet d'intérogé grammalecte sans zone
function sendToGrammalecte (oDataAction) {
    let oDataToSend = oDataAction;
    if (typeof oDataToSend.sActionId === "undefined") {
        oDataToSend.sActionId = uniqueID();
    }
    if (oDataAction.elm) {
        if (!oDataAction.elm.id) {
            oDataAction.elm.id = uniqueID();
        }
        oDataToSend.elm = oDataAction.elm.id;
    }
    //console.log('oDataToSend', oDataToSend);
    let eventGrammalecte = new CustomEvent("GrammalecteEvent", { detail: JSON.stringify(oDataToSend) });
    document.dispatchEvent(eventGrammalecte);
    return oDataToSend.sActionId;
}

// ! Envoie de l’information que l'injection est bien faite ;)
// (peut être lu aussi bien par la page web que le content script)
var customAPILoaded = new CustomEvent("GLInjectedScriptIsReady");
document.dispatchEvent(customAPILoaded);

// Gros Hack : Auto add a button in tinymce ;)

// Page to test v4 https://www.quackit.com/html/html_editors/tinymce_editor.cfm
// https://www.responsivefilemanager.com/demo.php

// Page to test v3 http://www.imathas.com/editordemo/demo.html

function TinyOnEditor (event, editor=null) {
    let xEditorAdd = editor || event.editor;
    //console.log(xEditorAdd);
    if (typeof xEditorAdd.settings.Grammalecte === "undefined") {
        let aBtn;
        let cPlugSep;
        let bIsAdded = false;
        if (tinyMCE.majorVersion >= 4) {
            cPlugSep = " ";
            aBtn = ["toolbar3", "toolbar2", "toolbar1", "toolbar"];
        } else if (tinyMCE.majorVersion >= 3) {
            cPlugSep = ",";
            aBtn = ["theme_advanced_buttons3", "theme_advanced_buttons2", "theme_advanced_buttons1", "theme_advanced_buttons1_add_before"];
        }

        let sBtn;
        let iBtn = 0;
        for (sBtn of aBtn) {
            if (!bIsAdded && (typeof xEditorAdd.settings[sBtn] !== "undefined" || iBtn == aBtn.length)) {
                bIsAdded = true;
                if (typeof xEditorAdd.settings[sBtn] !== "undefined" && xEditorAdd.settings[sBtn] !== "") {
                    xEditorAdd.settings[sBtn] = (xEditorAdd.settings[sBtn] + cPlugSep + "Grammalecte").trim();
                } else {
                    let m = /(.*)([0-9])/.exec(sBtn);
                    if (m.length === 3 && parseInt(m[2]) > 1 && xEditorAdd.settings[sBtn] === "") {
                        sBtn = m[1] + (parseInt(m[2]) - 1);
                        xEditorAdd.settings[sBtn] = (xEditorAdd.settings[sBtn] + cPlugSep + "Grammalecte").trim();
                    } else {
                        xEditorAdd.settings[sBtn] = "Grammalecte";
                    }
                }
            }
            iBtn++;
        }
        if (!bIsAdded) {
            //Valeur par defaut
            xEditorAdd.settings[sBtn] =
                "undo redo | styleselect | bold italic | alignleft" +
                " aligncenter alignright alignjustify | " +
                " bullist numlist outdent indent | link image" +
                " Grammalecte";
        }
        xEditorAdd.settings["Grammalecte"] = true;
    }

    xEditorAdd.addButton("Grammalecte", {
        text: "",
        icon: false,
        image: sBrowserURL + "img/logo-16.png",
        //"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAC8UlEQVQ4jX3TbUgTcRwH8P89ddu5u9tt082aZmpFEU4tFz0QGTUwCi0heniR9MSUIKRaD0RvIlKigsooo+iNFa0XJYuwIjEK19OcDtPElsG0ktyp591t7u7+vUh7MPX3+vf5/n8/+P0BmKJIPUUVlh2rdVVeesWlzEybqg+bFOsoylnqPmNavGFfknV2Omu2Lvja3vxAURKJib3opHizu8riLK6gjRyuKgmoSoMRFENRUqfXTzvBGK62LC2uoFkOl4RhjQ8+qWt7dPNE3sbdp+2LXbsGe9qb4rIo/BfwFy6nWQ4ThWGNDzbcfu29dMDh2nHU7CypYNLmzTda0/L5cNuzmDQi/A4Y27k6eQxLI79wS/11D0AAMNvs6XT6ojVJjJEgTbMy2BT77xBMp09KcpaWV1uc41jQoi0NdUHfjeOO9WWn7AVF7s7n986SithPJGeupBh2PCSP/xxqxAp3eq6wuUV7Wc6MSZIEhA8vHjbfOe/OcW3zmAuKy+nUzAyD2bow8ODaEROFq8AyZ5WBYdEZXGqGxZ61HJV+9HYCJRbTNA0QBA40HWunaKN5dKg/DBKxeCIe09Th/m4MJwiMSZmLEzMQAABQRuNqgu8NYX3doTcMpvCkLbtQZ2AJkrPOZG1zlnY13T+Hy9EehY90h57eqcorcZ/lctZuMzAsOjLEqwNv66/6vZcPYRBC+C3cGaBxhSet2av1BpYgTTY7k5y2JPT41slIR6Axv8R9nnOs+4Pf+2r992uOxGVJwgAAAEINfgt3BGgsESWtWas1iGDyl+CT/u7WpvxNFRc4x7qtBoZFhSFejb7z1fq9NYfjsiT+cwcQavBruCOgU4SIGo18amuoq3Js3FNlynVtH385+s53ze+t8cRkURx3yMTTRBAEQVAUXbFlf3XystJKA2NExeFBdWASDAAA+MQACCEEmqbJ0b6PMC7JwhDU8YFHV5u9NZ64LErT/oW/63tPV6uJwmKoOND78u7Fg5NhAAD4CVbzY9cwrWQrAAAAAElFTkSuQmCC",
        onclick: function (e) {
            //console.log(xEditorAdd.getContent());
            //console.log(xEditorAdd.getBody().innerText);
            let sText = xEditorAdd.getBody().innerText;
            let iframeElement;
            if (typeof xEditorAdd.iframeElement !== "undefined" && typeof xEditorAdd.iframeElement.id !== "undefined") {
                iframeElement = xEditorAdd.iframeElement.id;
            } else if (typeof xEditorAdd.editorId !== "undefined") {
                iframeElement = xEditorAdd.editorId + "_ifr";
            }
            sendToGrammalecte({ sTextToParse: sText, iframe: iframeElement });
        }
    });
}

function TinyInPage () {
    for (let i = tinyMCE.editors.length - 1;  i > -1;  i--) {
        let sTinyId = tinyMCE.editors[i].id;
        if (typeof tinyMCE.editors[i].settings.Grammalecte === "undefined") {
            TinyIDInPage(sTinyId);
        }
    }
}

function TinyIDInPage (sTinyId) {
    if (tinyMCE.majorVersion >= 4) {
        tinyMCE.EditorManager.execCommand("mceFocus", true, sTinyId);
        tinyMCE.EditorManager.execCommand("mceRemoveEditor", true, sTinyId);
        tinyMCE.EditorManager.execCommand("mceAddEditor", false, sTinyId);
    } else if (tinyMCE.majorVersion >= 3) {
        tinyMCE.execCommand("mceFocus", false, sTinyId);
        tinyMCE.execCommand("mceRemoveControl", true, sTinyId);
        tinyMCE.execCommand("mceAddControl", false, sTinyId);
    }
}

if (typeof tinyMCE !== "undefined" && tinyMCE.majorVersion && tinyMCE.majorVersion >= 3 && tinyMCE.majorVersion <= 5) {
    //console.log("Have TinyMCE");
    if (tinyMCE.majorVersion >= 4) {
        tinyMCE.on("AddEditor", TinyOnEditor);
    } else if (tinyMCE.majorVersion >= 3) {
        tinyMCE.onAddEditor.add(TinyOnEditor);
    }
    try {
        TinyInPage();
    } catch (e) {
        console.error(e);
    }
}

/* // ! In the webpage script :
document.addEventListener('GLInjectedScriptIsReady', function() {
    // Le gestionnaire d'évènement est prêt!
    // La page web peut effectuer des actions
    ...
});
...
// Pour demander une correction sur le texte
sendToGrammalecte({"sTextToParse": "salut comment ca vaa?"});
// Pour demander une correction sur un élément html
sendToGrammalecte({"sTextToParse": true, "elm": elementHTML});
// Pour avoir le lexicographe sur un texte
sendToGrammalecte({"sTextForLexicographer": "salut comment ca vaa?"});
// Pour avoir le lexicographe sur un élément html
sendToGrammalecte({"sTextForLexicographer": true, "elm": elementHTML});
*/
