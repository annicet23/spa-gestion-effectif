// src/data/orgData.js
const orgChartData = [
  {
    name: 'Commandant de l\'école',
    attributes: {
      grade: 'RABEMANANTSOA Fetrarivo',
      nom: 'COLONEL',
      photo: 'https://www.gettyimages.com/photos/ss-commandant', // Remplacez par l'URL réelle de la photo
    },
    children: [
      {
        name: 'Service CAB',
        attributes: {
          grade: '[Grade Chef CAB]',
          nom: '[Nom Chef CAB]',
          photo: 'https://www.istockphoto.com/photos/chef-kitchen',
        },
      },
      {
        name: 'Service SAF',
        attributes: {
          grade: 'RANDRIANASOLO Sylvain Daniel',
          nom: 'LIEUTENANT-COLONEL',
          photo: 'https://www.facebook.com/ash.hass.7/',
        },
      },
      {
        name: 'Direction de l\'Instruction',
        attributes: {
          grade: 'LIEUTENANT-COLONEL',
          nom: 'ANDRIANTSIRANOMENA Rajo Christian',
          photo: 'https://www.cyberlink.com/learning/photodirector-photo-editing-software',
        },
        children: [
          {
            name: 'DI/SIAT',
            attributes: {
              grade: '[Grade Chef SIAT]',
              nom: '[Nom Chef SIAT]',
              photo: 'https://www.facebook.com/SiaPersonalChef/',
            },
          },
          {
            name: 'INFO',
            attributes: {
              grade: '[Grade Chef DIV INFO]',
              nom: '[Nom Chef DIV INFO]',
              photo: 'https://www.fsolver.fr/mots-fleches/CHEF*DE*LA*PHOTO',
            },
          },
          {
            name: 'PEDA',
            attributes: {
              grade: '[Grade Chef DIV PEDA]',
              nom: '[Nom Chef DIV PEDA]',
              photo: 'https://www.instagram.com/p/DJb_5OwOfjw/',
            },
          },
          {
            name: 'SSL',
            attributes: {
              grade: '[Grade Chef DIV SSL]',
              nom: '[Nom Chef DIV SSL]',
              photo: 'https://docs.chef.io/server/server_security/',
            },
          },
          {
            name: 'SED',
            attributes: {
              grade: '[Grade Chef DIV SED]',
              nom: '[Nom Chef DIV SED]',
              photo: 'https://www.instagram.com/chefsedd/',
            },
          },
          {
            name: 'COURS',
            children: [
              {
                name: 'COURS A',
                children: Array.from({ length: 5 }).map((_, i) => ({
                  name: `Escadron ${2 * i + 1}`, // Escadrons impairs pour Cours A
                  children: Array.from({ length: 3 }).map((_, j) => ({
                    name: `Peloton ${j + 1}`,
                    // Vous pouvez ajouter les informations du chef de peloton ici si nécessaire
                    attributes: {
                       grade: '[Grade Chef Peloton]',
                       nom: '[Nom Chef Peloton]',
                       photo: 'https://www.instagram.com/reel/DJFPRIAOcmn/',
                    }
                  })),
                  attributes: {
                     grade: '[Grade Chef Escadron]',
                     nom: '[Nom Chef Escadron]',
                     photo: 'https://en.wikipedia.org/wiki/Chef_d%27escadron',
                  }
                })),
              },
              {
                name: 'COURS B',
                 children: Array.from({ length: 5 }).map((_, i) => ({
                  name: `Escadron ${2 * (i + 1)}`, // Escadrons pairs pour Cours B
                  children: Array.from({ length: 3 }).map((_, j) => ({
                    name: `Peloton ${j + 1}`,
                     attributes: {
                       grade: '[Grade Chef Peloton]',
                       nom: '[Nom Chef Peloton]',
                       photo: 'https://www.instagram.com/reel/DJFPRIAOcmn/',
                    }
                  })),
                   attributes: {
                     grade: '[Grade Chef Escadron]',
                     nom: '[Nom Chef Escadron]',
                     photo: 'https://en.wikipedia.org/wiki/Chef_d%27escadron',
                  }
                })),
              },
            ],
          },
        ],
      },
      {
        name: 'Service Materiel',
        attributes: {
          grade: '[Grade Chef Materiel]',
          nom: '[Nom Chef Materiel]',
          photo: 'https://www.istockphoto.com/photos/chefs-tools',
        },
      },
    ],
  },
];

export default orgChartData; // Exporter les données