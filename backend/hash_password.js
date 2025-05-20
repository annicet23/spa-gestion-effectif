const bcrypt = require('bcrypt');

const plaintextPassword = 'annicet23'; // <-- REMPLACEZ PAR VOTRE MOT DE PASSE CHOISI
const saltRounds = 10; // Doit correspondre au SALT_ROUNDS utilisé dans votre modèle User

bcrypt.hash(plaintextPassword, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
    } else {
        console.log('Mot de passe haché :');
        console.log(hash); // <-- C'est ce hash que vous allez copier
    }
    process.exit(); // Quitter le script
});