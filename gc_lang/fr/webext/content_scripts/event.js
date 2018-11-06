
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