
var min = Math.ceil(0);
var max = Math.floor(9999999);
function uniqueID() {
    return (Date.now()).toString(36) + '-' + (Math.floor(Math.random() * (max - min)) + min).toString(36);
}

// Retourne un identifiant unique au cas ou si besoin
// La ID unique peut être util si on permet d'intérogé grammalecte sans zone
function sendToGrammalecte(dataAction) {
    let dataToSend = dataAction;
    dataToSend.IdAction = uniqueID();
    if (dataAction.elm){
        if (!dataAction.elm.id){
            dataAction.elm.id = uniqueID();
        }
        dataToSend.elm = dataAction.elm.id;
    }

    //console.log('dataToSend', dataToSend);
    var eventGrammalecte = new CustomEvent('GrammalecteEvent', {"detail":dataToSend});
    document.dispatchEvent(eventGrammalecte);
    return dataToSend.IdAction;
}

// On informe la page qu'il y a Grammalecte ;)
var customAPILoaded = new CustomEvent('GrammalecteIsLoaded');
document.dispatchEvent(customAPILoaded);

// Gros Hack : Auto add a button in tinymce ;)
// Page to test v4 https://www.quackit.com/html/html_editors/tinymce_editor.cfm
// Page to test v3 http://www.imathas.com/editordemo/demo.html
if (typeof tinymce !== "undefined" && tinymce.majorVersion && tinymce.majorVersion >= 3 && tinymce.majorVersion <= 5) {
    //console.log("Have TinyMCE");
    let TinyOnEditor = function(event, editor = null) {
        let xEditorAdd = editor || event.editor;
        let bIsAdded = false;

        if ( tinymce.majorVersion >= 4 ){
            let aBtn = ["toolbar3", "toolbar2", "toolbar1", "toolbar"];
            let nBtn = aBtn.length;
            let iBtn = 0;
            for (let eBtn of aBtn){
                if ((!bIsAdded && typeof xEditorAdd.settings[eBtn] !== "undefined") || iBtn == nBtn){
                    bIsAdded = true;
                    xEditorAdd.settings[eBtn] = (xEditorAdd.settings[eBtn] + " Grammalecte").trim()
                }
                iBtn++;
            }
        } else if ( tinymce.majorVersion >= 3 ){
            let aBtn = ["theme_advanced_buttons3", "theme_advanced_buttons2", "theme_advanced_buttons1"];
            let nBtn = aBtn.length;
            let iBtn = 0;
            for (let eBtn of aBtn){
                if ((!bIsAdded && typeof xEditorAdd.settings[eBtn] !== "undefined") || iBtn == nBtn){
                    bIsAdded = true;
                    xEditorAdd.settings[eBtn] = (xEditorAdd.settings[eBtn] + ",Grammalecte").trim()
                }
                iBtn++;
            }
        }

        xEditorAdd.addButton("Grammalecte", {
            text: "",
            icon: false,
            image:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAC8UlEQVQ4jX3TbUgTcRwH8P89ddu5u9tt082aZmpFEU4tFz0QGTUwCi0heniR9MSUIKRaD0RvIlKigsooo+iNFa0XJYuwIjEK19OcDtPElsG0ktyp591t7u7+vUh7MPX3+vf5/n8/+P0BmKJIPUUVlh2rdVVeesWlzEybqg+bFOsoylnqPmNavGFfknV2Omu2Lvja3vxAURKJib3opHizu8riLK6gjRyuKgmoSoMRFENRUqfXTzvBGK62LC2uoFkOl4RhjQ8+qWt7dPNE3sbdp+2LXbsGe9qb4rIo/BfwFy6nWQ4ThWGNDzbcfu29dMDh2nHU7CypYNLmzTda0/L5cNuzmDQi/A4Y27k6eQxLI79wS/11D0AAMNvs6XT6ojVJjJEgTbMy2BT77xBMp09KcpaWV1uc41jQoi0NdUHfjeOO9WWn7AVF7s7n986SithPJGeupBh2PCSP/xxqxAp3eq6wuUV7Wc6MSZIEhA8vHjbfOe/OcW3zmAuKy+nUzAyD2bow8ODaEROFq8AyZ5WBYdEZXGqGxZ61HJV+9HYCJRbTNA0QBA40HWunaKN5dKg/DBKxeCIe09Th/m4MJwiMSZmLEzMQAABQRuNqgu8NYX3doTcMpvCkLbtQZ2AJkrPOZG1zlnY13T+Hy9EehY90h57eqcorcZ/lctZuMzAsOjLEqwNv66/6vZcPYRBC+C3cGaBxhSet2av1BpYgTTY7k5y2JPT41slIR6Axv8R9nnOs+4Pf+2r992uOxGVJwgAAAEINfgt3BGgsESWtWas1iGDyl+CT/u7WpvxNFRc4x7qtBoZFhSFejb7z1fq9NYfjsiT+cwcQavBruCOgU4SIGo18amuoq3Js3FNlynVtH385+s53ze+t8cRkURx3yMTTRBAEQVAUXbFlf3XystJKA2NExeFBdWASDAAA+MQACCEEmqbJ0b6PMC7JwhDU8YFHV5u9NZ64LErT/oW/63tPV6uJwmKoOND78u7Fg5NhAAD4CVbzY9cwrWQrAAAAAElFTkSuQmCC",
            onclick: function(e) {
                //console.log( editorAdd.getContent() );
                //console.log( editorAdd.getBody().innerText )
                let sText = xEditorAdd.getBody().innerText;
                sendToGrammalecte({ spellcheck: sText });
            }
        });
    };
    if ( tinymce.majorVersion >= 4 ){
        tinymce.on("AddEditor", TinyOnEditor);
    } else if ( tinymce.majorVersion >= 3 ){
        tinymce.onAddEditor.add(TinyOnEditor);
    }

    for (var i = tinymce.editors.length - 1; i > -1; i--) {
        let idTiny = tinymce.editors[i].id;
        if ( tinymce.majorVersion >= 4 ){
            tinymce.execCommand("mceRemoveEditor", true, idTiny);
            tinymce.execCommand("mceAddEditor", true, idTiny);
        } else if ( tinymce.majorVersion >= 3 ){
            tinymce.execCommand("mceRemoveControl", true, idTiny);
            tinymce.execCommand("mceAddControl", true, idTiny);
        }
    }
}

/* // ! In the webpage script :
document.addEventListener('GrammalecteIsLoaded', function() {
    // Le gestionnaire d'évènement est prêt!
    // La page web peut effectuer des actions
    ...
});
...
// Pour demander une correction sur le texte
sendToGrammalecte({"spellcheck": "salut comment ca vaa?"});
// Pour demander une correction sur un élément html
sendToGrammalecte({"spellcheck": true, "elm": elementHTML});
// Pour avoir le lexicographe sur un texte
sendToGrammalecte({"lexique": "salut comment ca vaa?"});
// Pour avoir le lexicographe sur un élément html
sendToGrammalecte({"lexique": true, "elm": elementHTML});
*/
