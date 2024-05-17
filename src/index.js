console.log("Conectado");

import { Server as WebSocketServer } from "socket.io";
import express from "express";
import http from "http";
import { log } from "console";


const connection = require("./bdconfig");
const session = require('express-session');

const app = express();
const httpServer = http.createServer(app);
const io = new WebSocketServer(httpServer);
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname + "/public"));


app.post('/inicio', (req, res) => {
    const { username } = req.body;
    req.session.usuario = username;
    res.redirect('/');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/public/index2.html");
});


app.get('/ubicaciones', (req, res) => {
    res.sendFile(__dirname + "/public/ubicaciones.html");

});

app.get('/api/sesion', (req, res) => {
    res.json({ usuario: req.session.usuario });
});

app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

httpServer.listen(3000);



io.on("connection", (socket) => {
    console.log("Nueva visita de ubicaciones");

    TomarYEnviarUbicaciones();

    const intervalo = setInterval(TomarYEnviarUbicaciones, 6000);

    socket.on("disconnect", () => {
        clearInterval(intervalo);
        console.log("Se ha desconectado el cliente");
    });
});

const googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyCkF9dXkDa3GjKlrLUdLc7BEx5031MELDQ', // Reemplaza con tu API Key de Google Maps
    Promise: Promise
});


const R = 6371e3; // Radio de la Tierra en metros

function haversine(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Devuelve la distancia en metros
}


/*
function TomarYEnviarUbicaciones() {
    TomarUbicacionesPorRatos()
        .then(ubicacionVehiculo => {
            const [vehiculo] = ubicacionVehiculo;
            const rutaPendiente = [];
            const rutaRecorrida = [];

            ruta.forEach(punto => {
                const distancia = haversine(vehiculo.Latitude, vehiculo.Longitude, parseFloat(punto.Latitude), parseFloat(punto.Longitude));
                if (distancia < 200) { // 100 metros como umbral de proximidad
                    rutaRecorrida.push(punto);
                } else {
                    rutaPendiente.push(punto);
                }
            });

            io.sockets.emit("ubi:show", ubicacionVehiculo);
            io.sockets.emit("rutaRecorrida", rutaRecorrida);
            io.sockets.emit("rutaPendiente", rutaPendiente);
        })
        .catch(error => {
            console.error("Error al tomar los mensajes de la base de datos:", error);
        });

}

*/

function TomarYEnviarUbicaciones() {
    TomarUbicacionesPorRatos()
        .then(ubicacionVehiculo => {
            const [vehiculo] = ubicacionVehiculo;
            let ultimoPuntoRecorridoIndex = -1;

            // Determinar hasta qué punto ha llegado el vehículo
            ruta.forEach((punto, index) => {
                const distancia = haversine(vehiculo.Latitude, vehiculo.Longitude, parseFloat(punto.Latitude), parseFloat(punto.Longitude));
                if (distancia < 20) { // 100 metros como umbral de proximidad
                    ultimoPuntoRecorridoIndex = index;
                }
            });

            const rutaRecorrida = ruta.slice(0, ultimoPuntoRecorridoIndex );
            const rutaPendiente = ruta.slice(ultimoPuntoRecorridoIndex );

            io.sockets.emit("ubi:show", ubicacionVehiculo);
            io.sockets.emit("rutaRecorrida", rutaRecorrida);
            io.sockets.emit("rutaPendiente", rutaPendiente);
        })
        .catch(error => {
            console.error("Error al tomar los mensajes de la base de datos:", error);
        });
}


app.get('/mapa', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Mapa con ruta</title>
            <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCkF9dXkDa3GjKlrLUdLc7BEx5031MELDQ&callback=initMap" async defer></script>
        </head>
        <body>
            <div id="map" style="height: 100%; width: 100%;"></div>
            <script>
                var ruta = ${JSON.stringify(ruta)};
                var map;
                var rutaIndex = 0;
                var path;
                
                function initMap() {
                    map = new google.maps.Map(document.getElementById("map"), {
                        zoom: 14,
                        center: { lat: 18.451660, lng: -97.398060 }
                    });
  
                    path = new google.maps.Polyline({
                        geodesic: true,
                        strokeColor: "#FF0000",
                        strokeOpacity: 1.0,
                        strokeWeight: 2
                    });
  
                    dibujarRuta();
  
                }
  
                function dibujarRuta() {
                    var pathCoordinates = [];
                    for (var i = 0; i < 20 && (rutaIndex + i) < ruta.length; i++) {
                        pathCoordinates.push({
                            lat: parseFloat(ruta[rutaIndex + i].Latitude),
                            lng: parseFloat(ruta[rutaIndex + i].Longitude)
                        });
                        console.log("Elemento mostrado:", ruta[rutaIndex + i]);
                    }
                    path.setPath(pathCoordinates);
                    path.setMap(map);
                    rutaIndex++;
                    if (rutaIndex + 20 < ruta.length) {
                        setTimeout(dibujarRuta, 1000);
                    }
                }
            </script>
        </body>
        </html>
    `);
});


const puntosVisitados = {};

async function calcularTiempoDeLlegada(origen, destino) {
    try {
        const response = await googleMapsClient.directions({
            origin: origen,
            destination: destino,
            mode: 'driving' // Modo de transporte: en auto
        }).asPromise();

        // Verificar si se encontró una ruta válida
        if (response.json.status === 'OK') {
            const tiempoEstimado = response.json.routes[0].legs[0].duration.text;
            // Emitir el tiempo estimado a través del socket
            io.sockets.emit("tiempoEstimado", tiempoEstimado);

            console.log("El tiempo estimado es " + tiempoEstimado);

            // Calcular la distancia entre el origen y el destino
            const distancia = response.json.routes[0].legs[0].distance.value; // en metros

            // Verificar si la distancia es menor o igual a 200 metros
            if (distancia <= 200) {
                console.log("¡Ya ha llegado al destino!");
            }
        } else {
            console.error('No se encontró una ruta válida.');
            // Emitir el error a través del socket
            io.sockets.emit("errorRuta", 'No se encontró una ruta válida.');
            console.error('No se encontró una ruta válida.')
        }
    } catch (error) {
        console.error('Error al calcular el tiempo de llegada:', error);
        // Emitir el error a través del socket
        io.sockets.emit("errorRuta", error.message);
    }
}


/*
async function TomarYEnviarUbicaciones() {
    try {
        const ubicaciones = await TomarUbicacionesPorRatos();
        const ubicacionesGuardados = ubicaciones;

        io.sockets.emit("ubi:show", ubicacionesGuardados);

        for (let i = 0; i < ubicacionesGuardados.length - 1; i++) {
            const ubicacionActual = ubicacionesGuardados[i];
            const ubicacionSiguiente = ubicacionesGuardados[i + 1];
            const origen = `${ubicacionActual.Latitude},${ubicacionActual.Longitude}`;
            const destino = `${ubicacionSiguiente.Latitude},${ubicacionSiguiente.Longitude}`;

            // Verificar si ya ha pasado por esta ubicación
            if (puntosVisitados[origen]) {
                console.log("Ya pasó por esta zona");
                continue; // Saltar al siguiente punto
            }

            await calcularTiempoDeLlegada(origen, destino);

            // Marcar el punto como visitado
            puntosVisitados[origen] = true;
        }

        // Calcular tiempo de llegada al punto 119
        const punto118 = ubicacionesGuardados[ubicacionesGuardados.length - 1];
        const origen119 = `${punto118.Latitude},${punto118.Longitude}`;
        const destino119 = `${ruta[119].Latitude},${ruta[119].Longitude}`;
        await calcularTiempoDeLlegada(origen119, destino119);

        // Verificar si ya ha pasado por el destino 119
        if (puntosVisitados[destino119]) {
            console.log("Ya pasó por el destino 119");
        }
    } catch (error) {
        console.error("Error al tomar los mensajes de la base de datos:", error);
    }
}
*/

/*
function TomarYEnviarUbicaciones() {
    TomarUbicacionesPorRatos()
      .then(ubicaciones => {
        const ubicacionesGuardados = ubicaciones;
        io.sockets.emit("ubi:show", ubicacionesGuardados);
      })
      .catch(error => {
        console.error("Error al tomar los mensajes de la base de datos:", error);
      });
  }
*/

/*
function TomarYEnviarUbicacionesCalculo() {
    TomarUbicacionesPorRatos()
        .then(ubicaciones => {
            const ubicacionesGuardados = ubicaciones;
            io.sockets.emit("ubi:show", ubicacionesGuardados);

            const puntosRecorridos = [];
            const proximosPuntos = [];
            ubicacionesGuardados.forEach(ubicacion => {
                const latitud = parseFloat(ubicacion.Latitude);
                const longitud = parseFloat(ubicacion.Longitude);
                const velocidad = parseFloat(ubicacion.Speed); // Obtener velocidad de la ubicación

                // Calcular distancia con respecto a la ruta
                const distancias = ruta.map(ubicacionRuta => {
                    return google.maps.geometry.spherical.computeDistanceBetween(
                        new google.maps.LatLng(latitud, longitud),
                        new google.maps.LatLng(parseFloat(ubicacionRuta.Latitude), parseFloat(ubicacionRuta.Longitude))
                    );
                });

                // Determinar puntos recorridos y próximos puntos
                let recorridoCompleto = false;
                distancias.forEach((distancia, index) => {
                    if (!recorridoCompleto) {
                        if (distancia < 50) {
                            puntosRecorridos.push(index);
                        } else {
                            recorridoCompleto = true;
                        }
                    } else {
                        proximosPuntos.push(index);
                    }
                });
            });

            if (puntosRecorridos.length > 0 || proximosPuntos.length > 0) {
                io.sockets.emit("ruta:puntos", { puntosRecorridos, proximosPuntos });
            }

        })
        .catch(error => {
            console.error("Error al tomar los mensajes de la base de datos:", error);
        });
}
*/

function TomarUbicacionesPorRatos() {
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM ubicaciones_forma ORDER BY ID DESC limit 1";

        connection.query(query, (error, results) => {
            if (error) {
                console.error("Error al ejecutar la consulta:", error);
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}










app.get('/mapaConSecuencia', (req, res) => {
    res.send('<html><head><title>Mapa con ruta</title><script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCkF9dXkDa3GjKlrLUdLc7BEx5031MELDQ&callback=initMap" async defer loading="async"></script></head><body><div id="map" style="height: 100%; width: 100%;"></div><script>function initMap() { var map = new google.maps.Map(document.getElementById("map"), { zoom: 14, center: { lat: 18.451660, lng: -97.398060 } }); var pathCoordinates = ' + JSON.stringify(ruta.map(coord => ({ lat: parseFloat(coord.Latitude), lng: parseFloat(coord.Longitude) }))) + '; var path = new google.maps.Polyline({ path: pathCoordinates, geodesic: true, strokeColor: "#FF0000", strokeOpacity: 1.0, strokeWeight: 2 }); path.setMap(map); }</script></body></html>');
});

app.get('/mapaUbicaciones', (req, res) => {
    res.sendFile(__dirname + "/public/mapa.html");

});



app.get('/route', (req, res) => {
    // Tomar el elemento 120 del JSON
    const elemento120 = ruta[119]; // Los índices de los arrays en JavaScript comienzan en 0

    res.json({ elemento120 });
});





const ruta = [
    {
        "Latitude": "18.450385",
        "Longitude": "-97.398042"
    },
    {
        "Latitude": "18.451075",
        "Longitude": "-97.397552"
    },
    {
        "Latitude": "18.451660",
        "Longitude": "-97.398060"
    },
    {
        "Latitude": "18.452527",
        "Longitude": "-97.398250"
    },
    {
        "Latitude": "18.453405",
        "Longitude": "-97.398110"
    },
    {
        "Latitude": "18.453375",
        "Longitude": "-97.397030"
    },
    {
        "Latitude": "18.453545",
        "Longitude": "-97.396072"
    },
    {
        "Latitude": "18.452700",
        "Longitude": "-97.395775"
    },
    {
        "Latitude": "18.451710",
        "Longitude": "-97.395790"
    },
    {
        "Latitude": "18.451450",
        "Longitude": "-97.396575"
    },
    {
        "Latitude": "18.451042",
        "Longitude": "-97.397127"
    },
    {
        "Latitude": "18.450070",
        "Longitude": "-97.397155"
    },
    {
        "Latitude": "18.449872",
        "Longitude": "-97.397220"
    },
    {
        "Latitude": "18.449872",
        "Longitude": "-97.397220"
    },
    {
        "Latitude": "18.449872",
        "Longitude": "-97.397220"
    },
    {
        "Latitude": "18.449830",
        "Longitude": "-97.397322"
    },
    {
        "Latitude": "18.449785",
        "Longitude": "-97.397310"
    },
    {
        "Latitude": "18.450797",
        "Longitude": "-97.397160"
    },
    {
        "Latitude": "18.451557",
        "Longitude": "-97.397382"
    },
    {
        "Latitude": "18.451570",
        "Longitude": "-97.397420"
    },
    {
        "Latitude": "18.451887",
        "Longitude": "-97.398245"
    },
    {
        "Latitude": "18.452885",
        "Longitude": "-97.398242"
    },
    {
        "Latitude": "18.453350",
        "Longitude": "-97.397565"
    },
    {
        "Latitude": "18.453640",
        "Longitude": "-97.396745"
    },
    {
        "Latitude": "18.454515",
        "Longitude": "-97.396832"
    },
    {
        "Latitude": "18.454555",
        "Longitude": "-97.397907"
    },
    {
        "Latitude": "18.454585",
        "Longitude": "-97.398932"
    },
    {
        "Latitude": "18.454615",
        "Longitude": "-97.399910"
    },
    {
        "Latitude": "18.454610",
        "Longitude": "-97.401007"
    },
    {
        "Latitude": "18.454620",
        "Longitude": "-97.402015"
    },
    {
        "Latitude": "18.453865",
        "Longitude": "-97.402392"
    },
    {
        "Latitude": "18.453597",
        "Longitude": "-97.403220"
    },
    {
        "Latitude": "18.453760",
        "Longitude": "-97.404190"
    },
    {
        "Latitude": "18.453282",
        "Longitude": "-97.404795"
    },
    {
        "Latitude": "18.452280",
        "Longitude": "-97.404805"
    },
    {
        "Latitude": "18.451627",
        "Longitude": "-97.404737"
    },
    {
        "Latitude": "18.451325",
        "Longitude": "-97.404717"
    },
    {
        "Latitude": "18.450820",
        "Longitude": "-97.404120"
    },
    {
        "Latitude": "18.450252",
        "Longitude": "-97.403922"
    },
    {
        "Latitude": "18.450257",
        "Longitude": "-97.403922"
    },
    {
        "Latitude": "18.450137",
        "Longitude": "-97.403570"
    },
    {
        "Latitude": "18.450090",
        "Longitude": "-97.402492"
    },
    {
        "Latitude": "18.449920",
        "Longitude": "-97.401622"
    },
    {
        "Latitude": "18.449015",
        "Longitude": "-97.402037"
    },
    {
        "Latitude": "18.448045",
        "Longitude": "-97.401992"
    },
    {
        "Latitude": "18.447030",
        "Longitude": "-97.401905"
    },
    {
        "Latitude": "18.446027",
        "Longitude": "-97.401830"
    },
    {
        "Latitude": "18.445050",
        "Longitude": "-97.401760"
    },
    {
        "Latitude": "18.444100",
        "Longitude": "-97.401697"
    },
    {
        "Latitude": "18.443585",
        "Longitude": "-97.401635"
    },
    {
        "Latitude": "18.443432",
        "Longitude": "-97.401632"
    },
    {
        "Latitude": "18.443365",
        "Longitude": "-97.401640"
    },
    {
        "Latitude": "18.443265",
        "Longitude": "-97.401822"
    },
    {
        "Latitude": "18.443595",
        "Longitude": "-97.402435"
    },
    {
        "Latitude": "18.444137",
        "Longitude": "-97.401785"
    },
    {
        "Latitude": "18.444080",
        "Longitude": "-97.400740"
    },
    {
        "Latitude": "18.443912",
        "Longitude": "-97.399737"
    },
    {
        "Latitude": "18.443085",
        "Longitude": "-97.399780"
    },
    {
        "Latitude": "18.443090",
        "Longitude": "-97.400095"
    },
    {
        "Latitude": "18.442875",
        "Longitude": "-97.400547"
    },
    {
        "Latitude": "18.442232",
        "Longitude": "-97.400135"
    },
    {
        "Latitude": "18.443280",
        "Longitude": "-97.400115"
    },
    {
        "Latitude": "18.444260",
        "Longitude": "-97.400185"
    },
    {
        "Latitude": "18.444562",
        "Longitude": "-97.400250"
    },
    {
        "Latitude": "18.444622",
        "Longitude": "-97.400260"
    },
    {
        "Latitude": "18.444622",
        "Longitude": "-97.400260"
    },
    {
        "Latitude": "18.444622",
        "Longitude": "-97.400260"
    },
    {
        "Latitude": "18.445325",
        "Longitude": "-97.400227"
    },
    {
        "Latitude": "18.445935",
        "Longitude": "-97.400997"
    },
    {
        "Latitude": "18.445985",
        "Longitude": "-97.402087"
    },
    {
        "Latitude": "18.446055",
        "Longitude": "-97.402880"
    },
    {
        "Latitude": "18.446110",
        "Longitude": "-97.403162"
    },
    {
        "Latitude": "18.446185",
        "Longitude": "-97.404182"
    },
    {
        "Latitude": "18.446280",
        "Longitude": "-97.405280"
    },
    {
        "Latitude": "18.446550",
        "Longitude": "-97.406230"
    },
    {
        "Latitude": "18.447477",
        "Longitude": "-97.406877"
    },
    {
        "Latitude": "18.448260",
        "Longitude": "-97.407457"
    },
    {
        "Latitude": "18.449040",
        "Longitude": "-97.408020"
    },
    {
        "Latitude": "18.449927",
        "Longitude": "-97.408657"
    },
    {
        "Latitude": "18.450775",
        "Longitude": "-97.409180"
    },
    {
        "Latitude": "18.451430",
        "Longitude": "-97.409295"
    },
    {
        "Latitude": "18.451425",
        "Longitude": "-97.409302"
    },
    {
        "Latitude": "18.451415",
        "Longitude": "-97.409305"
    },
    {
        "Latitude": "18.451740",
        "Longitude": "-97.409295"
    },
    {
        "Latitude": "18.452060",
        "Longitude": "-97.410197"
    },
    {
        "Latitude": "18.452975",
        "Longitude": "-97.410882"
    },
    {
        "Latitude": "18.453752",
        "Longitude": "-97.411455"
    },
    {
        "Latitude": "18.454352",
        "Longitude": "-97.411737"
    },
    {
        "Latitude": "18.454355",
        "Longitude": "-97.411735"
    },
    {
        "Latitude": "18.454355",
        "Longitude": "-97.411740"
    },
    {
        "Latitude": "18.454475",
        "Longitude": "-97.411947"
    },
    {
        "Latitude": "18.455220",
        "Longitude": "-97.412530"
    },
    {
        "Latitude": "18.455312",
        "Longitude": "-97.413375"
    },
    {
        "Latitude": "18.454905",
        "Longitude": "-97.414310"
    },
    {
        "Latitude": "18.454510",
        "Longitude": "-97.415242"
    },
    {
        "Latitude": "18.454057",
        "Longitude": "-97.416055"
    },
    {
        "Latitude": "18.453170",
        "Longitude": "-97.415625"
    },
    {
        "Latitude": "18.453422",
        "Longitude": "-97.414827"
    },
    {
        "Latitude": "18.452775",
        "Longitude": "-97.414235"
    },
    {
        "Latitude": "18.452237",
        "Longitude": "-97.414980"
    },
    {
        "Latitude": "18.451670",
        "Longitude": "-97.414915"
    },
    {
        "Latitude": "18.451657",
        "Longitude": "-97.414900"
    },
    {
        "Latitude": "18.451652",
        "Longitude": "-97.414915"
    },
    {
        "Latitude": "18.451387",
        "Longitude": "-97.414755"
    },
    {
        "Latitude": "18.451632",
        "Longitude": "-97.413825"
    },
    {
        "Latitude": "18.452610",
        "Longitude": "-97.414120"
    },
    {
        "Latitude": "18.453565",
        "Longitude": "-97.414630"
    },
    {
        "Latitude": "18.454405",
        "Longitude": "-97.415025"
    },
    {
        "Latitude": "18.454892",
        "Longitude": "-97.414052"
    },
    {
        "Latitude": "18.455315",
        "Longitude": "-97.413175"
    },
    {
        "Latitude": "18.455345",
        "Longitude": "-97.413075"
    },
    {
        "Latitude": "18.455775",
        "Longitude": "-97.412157"
    },
    {
        "Latitude": "18.456185",
        "Longitude": "-97.411240"
    },
    {
        "Latitude": "18.456615",
        "Longitude": "-97.410297"
    },
    {
        "Latitude": "18.456700",
        "Longitude": "-97.409952"
    },
    {
        "Latitude": "18.456712",
        "Longitude": "-97.409925"
    },
    {
        "Latitude": "18.456807",
        "Longitude": "-97.409980"
    },
    {
        "Latitude": "18.456922",
        "Longitude": "-97.409535"
    },
    {
        "Latitude": "18.456970",
        "Longitude": "-97.409352"
    },
    {
        "Latitude": "18.456960",
        "Longitude": "-97.409352"
    },
    {
        "Latitude": "18.456960",
        "Longitude": "-97.409355"
    },
    {
        "Latitude": "18.456297",
        "Longitude": "-97.409120"
    },
    {
        "Latitude": "18.455285",
        "Longitude": "-97.408975"
    },
    {
        "Latitude": "18.455110",
        "Longitude": "-97.408830"
    },
    {
        "Latitude": "18.455107",
        "Longitude": "-97.408835"
    },
    {
        "Latitude": "18.455120",
        "Longitude": "-97.408817"
    },
    {
        "Latitude": "18.455410",
        "Longitude": "-97.408970"
    },
    {
        "Latitude": "18.456110",
        "Longitude": "-97.409067"
    },
    {
        "Latitude": "18.457040",
        "Longitude": "-97.409200"
    },
    {
        "Latitude": "18.457915",
        "Longitude": "-97.409507"
    },
    {
        "Latitude": "18.458965",
        "Longitude": "-97.409455"
    },
    {
        "Latitude": "18.459995",
        "Longitude": "-97.409445"
    },
    {
        "Latitude": "18.461122",
        "Longitude": "-97.409457"
    },
    {
        "Latitude": "18.462212",
        "Longitude": "-97.409402"
    },
    {
        "Latitude": "18.463237",
        "Longitude": "-97.409367"
    },
    {
        "Latitude": "18.464275",
        "Longitude": "-97.409237"
    },
    {
        "Latitude": "18.464767",
        "Longitude": "-97.410080"
    },
    {
        "Latitude": "18.465085",
        "Longitude": "-97.411007"
    },
    {
        "Latitude": "18.465425",
        "Longitude": "-97.411977"
    },
    {
        "Latitude": "18.465775",
        "Longitude": "-97.412975"
    },
    {
        "Latitude": "18.466147",
        "Longitude": "-97.414010"
    },
    {
        "Latitude": "18.466525",
        "Longitude": "-97.415087"
    },
    {
        "Latitude": "18.466877",
        "Longitude": "-97.416015"
    },
    {
        "Latitude": "18.467247",
        "Longitude": "-97.416997"
    },
    {
        "Latitude": "18.467610",
        "Longitude": "-97.417980"
    },
    {
        "Latitude": "18.467965",
        "Longitude": "-97.418980"
    },
    {
        "Latitude": "18.468360",
        "Longitude": "-97.419925"
    },
    {
        "Latitude": "18.469025",
        "Longitude": "-97.420865"
    },
    {
        "Latitude": "18.469617",
        "Longitude": "-97.421675"
    },
    {
        "Latitude": "18.470200",
        "Longitude": "-97.422455"
    },
    {
        "Latitude": "18.470845",
        "Longitude": "-97.423310"
    },
    {
        "Latitude": "18.471445",
        "Longitude": "-97.424150"
    },
    {
        "Latitude": "18.472035",
        "Longitude": "-97.424947"
    },
    {
        "Latitude": "18.472707",
        "Longitude": "-97.425850"
    },
    {
        "Latitude": "18.473325",
        "Longitude": "-97.426692"
    },
    {
        "Latitude": "18.474012",
        "Longitude": "-97.427522"
    },
    {
        "Latitude": "18.474032",
        "Longitude": "-97.427535"
    },
    {
        "Latitude": "18.474480",
        "Longitude": "-97.428217"
    },
    {
        "Latitude": "18.474262",
        "Longitude": "-97.429292"
    },
    {
        "Latitude": "18.474405",
        "Longitude": "-97.430275"
    },
    {
        "Latitude": "18.473422",
        "Longitude": "-97.430427"
    },
    {
        "Latitude": "18.473150",
        "Longitude": "-97.430407"
    },
    {
        "Latitude": "18.473127",
        "Longitude": "-97.430412"
    },
    {
        "Latitude": "18.473382",
        "Longitude": "-97.431070"
    },
    {
        "Latitude": "18.473550",
        "Longitude": "-97.432150"
    },
    {
        "Latitude": "18.473712",
        "Longitude": "-97.433187"
    },
    {
        "Latitude": "18.473845",
        "Longitude": "-97.434197"
    },
    {
        "Latitude": "18.473980",
        "Longitude": "-97.435185"
    },
    {
        "Latitude": "18.474480",
        "Longitude": "-97.435335"
    },
    {
        "Latitude": "18.474825",
        "Longitude": "-97.435275"
    },
    {
        "Latitude": "18.475657",
        "Longitude": "-97.435342"
    },
    {
        "Latitude": "18.475955",
        "Longitude": "-97.436340"
    },
    {
        "Latitude": "18.476415",
        "Longitude": "-97.437262"
    },
    {
        "Latitude": "18.476945",
        "Longitude": "-97.438217"
    },
    {
        "Latitude": "18.477485",
        "Longitude": "-97.439115"
    },
    {
        "Latitude": "18.478035",
        "Longitude": "-97.440067"
    },
    {
        "Latitude": "18.478035",
        "Longitude": "-97.440067"
    },
    {
        "Latitude": "18.478555",
        "Longitude": "-97.440910"
    },
    {
        "Latitude": "18.479065",
        "Longitude": "-97.441765"
    },
    {
        "Latitude": "18.479555",
        "Longitude": "-97.442610"
    },
    {
        "Latitude": "18.480060",
        "Longitude": "-97.443487"
    },
    {
        "Latitude": "18.480577",
        "Longitude": "-97.444385"
    },
    {
        "Latitude": "18.481082",
        "Longitude": "-97.445272"
    },
    {
        "Latitude": "18.481620",
        "Longitude": "-97.446235"
    },
    {
        "Latitude": "18.482245",
        "Longitude": "-97.447290"
    },
    {
        "Latitude": "18.482735",
        "Longitude": "-97.448125"
    },
    {
        "Latitude": "18.482735",
        "Longitude": "-97.448125"
    },
    {
        "Latitude": "18.483290",
        "Longitude": "-97.449067"
    },
    {
        "Latitude": "18.483862",
        "Longitude": "-97.450062"
    },
    {
        "Latitude": "18.484402",
        "Longitude": "-97.450990"
    },
    {
        "Latitude": "18.484890",
        "Longitude": "-97.451840"
    },
    {
        "Latitude": "18.485460",
        "Longitude": "-97.452655"
    },
    {
        "Latitude": "18.486295",
        "Longitude": "-97.453100"
    },
    {
        "Latitude": "18.486297",
        "Longitude": "-97.453110"
    },
    {
        "Latitude": "18.486330",
        "Longitude": "-97.453155"
    },
    {
        "Latitude": "18.486300",
        "Longitude": "-97.453105"
    },
    {
        "Latitude": "18.485487",
        "Longitude": "-97.452845"
    },
    {
        "Latitude": "18.484815",
        "Longitude": "-97.451975"
    },
    {
        "Latitude": "18.484335",
        "Longitude": "-97.451152"
    },
    {
        "Latitude": "18.483727",
        "Longitude": "-97.450102"
    },
    {
        "Latitude": "18.483727",
        "Longitude": "-97.450102"
    },
    {
        "Latitude": "18.483220",
        "Longitude": "-97.449230"
    },
    {
        "Latitude": "18.482600",
        "Longitude": "-97.448150"
    },
    {
        "Latitude": "18.482065",
        "Longitude": "-97.447225"
    },
    {
        "Latitude": "18.481537",
        "Longitude": "-97.446312"
    },
    {
        "Latitude": "18.480955",
        "Longitude": "-97.445337"
    },
    {
        "Latitude": "18.480397",
        "Longitude": "-97.444377"
    },
    {
        "Latitude": "18.479845",
        "Longitude": "-97.443402"
    },
    {
        "Latitude": "18.479845",
        "Longitude": "-97.443402"
    },
    {
        "Latitude": "18.479290",
        "Longitude": "-97.442442"
    },
    {
        "Latitude": "18.478825",
        "Longitude": "-97.441640"
    },
    {
        "Latitude": "18.478657",
        "Longitude": "-97.441352"
    },
    {
        "Latitude": "18.478110",
        "Longitude": "-97.440420"
    },
    {
        "Latitude": "18.477520",
        "Longitude": "-97.439420"
    },
    {
        "Latitude": "18.477007",
        "Longitude": "-97.438605"
    },
    {
        "Latitude": "18.476477",
        "Longitude": "-97.437687"
    },
    {
        "Latitude": "18.475915",
        "Longitude": "-97.436692"
    },
    {
        "Latitude": "18.475600",
        "Longitude": "-97.435495"
    },
    {
        "Latitude": "18.475330",
        "Longitude": "-97.434315"
    },
    {
        "Latitude": "18.475097",
        "Longitude": "-97.433260"
    },
    {
        "Latitude": "18.474860",
        "Longitude": "-97.432250"
    },
    {
        "Latitude": "18.474600",
        "Longitude": "-97.431145"
    },
    {
        "Latitude": "18.474325",
        "Longitude": "-97.430105"
    },
    {
        "Latitude": "18.474105",
        "Longitude": "-97.429122"
    },
    {
        "Latitude": "18.473845",
        "Longitude": "-97.428052"
    },
    {
        "Latitude": "18.474417",
        "Longitude": "-97.427652"
    },
    {
        "Latitude": "18.475090",
        "Longitude": "-97.427070"
    },
    {
        "Latitude": "18.475700",
        "Longitude": "-97.426110"
    },
    {
        "Latitude": "18.475925",
        "Longitude": "-97.425765"
    },
    {
        "Latitude": "18.476280",
        "Longitude": "-97.425220"
    },
    {
        "Latitude": "18.476845",
        "Longitude": "-97.424365"
    },
    {
        "Latitude": "18.477110",
        "Longitude": "-97.423977"
    },
    {
        "Latitude": "18.477387",
        "Longitude": "-97.423572"
    },
    {
        "Latitude": "18.477965",
        "Longitude": "-97.422722"
    },
    {
        "Latitude": "18.478632",
        "Longitude": "-97.421702"
    },
    {
        "Latitude": "18.479207",
        "Longitude": "-97.420807"
    },
    {
        "Latitude": "18.479760",
        "Longitude": "-97.419955"
    },
    {
        "Latitude": "18.480290",
        "Longitude": "-97.419172"
    },
    {
        "Latitude": "18.480895",
        "Longitude": "-97.418310"
    },
    {
        "Latitude": "18.481505",
        "Longitude": "-97.417457"
    },
    {
        "Latitude": "18.482162",
        "Longitude": "-97.416465"
    },
    {
        "Latitude": "18.482747",
        "Longitude": "-97.415590"
    },
    {
        "Latitude": "18.483250",
        "Longitude": "-97.414772"
    },
    {
        "Latitude": "18.483837",
        "Longitude": "-97.413775"
    },
    {
        "Latitude": "18.484352",
        "Longitude": "-97.412935"
    },
    {
        "Latitude": "18.484870",
        "Longitude": "-97.411930"
    },
    {
        "Latitude": "18.485352",
        "Longitude": "-97.410905"
    },
    {
        "Latitude": "18.485825",
        "Longitude": "-97.409910"
    },
    {
        "Latitude": "18.486302",
        "Longitude": "-97.408887"
    },
    {
        "Latitude": "18.486740",
        "Longitude": "-97.407925"
    },
    {
        "Latitude": "18.487190",
        "Longitude": "-97.406965"
    },
    {
        "Latitude": "18.487710",
        "Longitude": "-97.405895"
    },
    {
        "Latitude": "18.488132",
        "Longitude": "-97.404905"
    },
    {
        "Latitude": "18.488025",
        "Longitude": "-97.403815"
    },
    {
        "Latitude": "18.488825",
        "Longitude": "-97.403985"
    },
    {
        "Latitude": "18.489480",
        "Longitude": "-97.404385"
    },
    {
        "Latitude": "18.489487",
        "Longitude": "-97.404377"
    },
    {
        "Latitude": "18.489477",
        "Longitude": "-97.404380"
    },
    {
        "Latitude": "18.489477",
        "Longitude": "-97.404380"
    },
    {
        "Latitude": "18.489477",
        "Longitude": "-97.404380"
    },
    {
        "Latitude": "18.489695",
        "Longitude": "-97.404480"
    },
    {
        "Latitude": "18.490532",
        "Longitude": "-97.405052"
    },
    {
        "Latitude": "18.489640",
        "Longitude": "-97.405382"
    },
    {
        "Latitude": "18.488645",
        "Longitude": "-97.405360"
    },
    {
        "Latitude": "18.487840",
        "Longitude": "-97.405890"
    },
    {
        "Latitude": "18.487385",
        "Longitude": "-97.406825"
    },
    {
        "Latitude": "18.486940",
        "Longitude": "-97.407785"
    },
    {
        "Latitude": "18.486485",
        "Longitude": "-97.408790"
    },
    {
        "Latitude": "18.486145",
        "Longitude": "-97.409510"
    },
    {
        "Latitude": "18.486067",
        "Longitude": "-97.409675"
    },
    {
        "Latitude": "18.485620",
        "Longitude": "-97.410587"
    },
    {
        "Latitude": "18.484990",
        "Longitude": "-97.411895"
    },
    {
        "Latitude": "18.484580",
        "Longitude": "-97.412752"
    },
    {
        "Latitude": "18.484090",
        "Longitude": "-97.413675"
    },
    {
        "Latitude": "18.483295",
        "Longitude": "-97.413660"
    },
    {
        "Latitude": "18.482357",
        "Longitude": "-97.413025"
    },
    {
        "Latitude": "18.481340",
        "Longitude": "-97.412345"
    },
    {
        "Latitude": "18.481340",
        "Longitude": "-97.412345"
    },
    {
        "Latitude": "18.480537",
        "Longitude": "-97.411807"
    },
    {
        "Latitude": "18.479530",
        "Longitude": "-97.411150"
    },
    {
        "Latitude": "18.478727",
        "Longitude": "-97.410645"
    },
    {
        "Latitude": "18.477897",
        "Longitude": "-97.410125"
    },
    {
        "Latitude": "18.477670",
        "Longitude": "-97.409955"
    },
    {
        "Latitude": "18.477087",
        "Longitude": "-97.409555"
    },
    {
        "Latitude": "18.476165",
        "Longitude": "-97.408930"
    },
    {
        "Latitude": "18.476210",
        "Longitude": "-97.408637"
    },
    {
        "Latitude": "18.476995",
        "Longitude": "-97.409160"
    },
    {
        "Latitude": "18.477170",
        "Longitude": "-97.408787"
    },
    {
        "Latitude": "18.477135",
        "Longitude": "-97.408730"
    },
    {
        "Latitude": "18.477105",
        "Longitude": "-97.408417"
    },
    {
        "Latitude": "18.477030",
        "Longitude": "-97.407417"
    },
    {
        "Latitude": "18.476965",
        "Longitude": "-97.406462"
    },
    {
        "Latitude": "18.476840",
        "Longitude": "-97.405352"
    },
    {
        "Latitude": "18.476692",
        "Longitude": "-97.404322"
    },
    {
        "Latitude": "18.476377",
        "Longitude": "-97.403555"
    },
    {
        "Latitude": "18.475355",
        "Longitude": "-97.403565"
    },
    {
        "Latitude": "18.474997",
        "Longitude": "-97.402757"
    },
    {
        "Latitude": "18.474855",
        "Longitude": "-97.401782"
    },
    {
        "Latitude": "18.474370",
        "Longitude": "-97.400915"
    },
    {
        "Latitude": "18.473990",
        "Longitude": "-97.400477"
    },
    {
        "Latitude": "18.473667",
        "Longitude": "-97.400110"
    },
    {
        "Latitude": "18.472875",
        "Longitude": "-97.399505"
    },
    {
        "Latitude": "18.473085",
        "Longitude": "-97.399225"
    },
    {
        "Latitude": "18.473197",
        "Longitude": "-97.399185"
    },
    {
        "Latitude": "18.473240",
        "Longitude": "-97.399155"
    },
    {
        "Latitude": "18.474032",
        "Longitude": "-97.399042"
    },
    {
        "Latitude": "18.475070",
        "Longitude": "-97.398842"
    },
    {
        "Latitude": "18.476062",
        "Longitude": "-97.398607"
    },
    {
        "Latitude": "18.477102",
        "Longitude": "-97.398340"
    },
    {
        "Latitude": "18.478025",
        "Longitude": "-97.398160"
    },
    {
        "Latitude": "18.478967",
        "Longitude": "-97.398415"
    },
    {
        "Latitude": "18.479792",
        "Longitude": "-97.398937"
    },
    {
        "Latitude": "18.480607",
        "Longitude": "-97.399445"
    },
    {
        "Latitude": "18.481555",
        "Longitude": "-97.399527"
    },
    {
        "Latitude": "18.482390",
        "Longitude": "-97.399085"
    },
    {
        "Latitude": "18.482887",
        "Longitude": "-97.398267"
    },
    {
        "Latitude": "18.483420",
        "Longitude": "-97.397247"
    },
    {
        "Latitude": "18.483945",
        "Longitude": "-97.396300"
    },
    {
        "Latitude": "18.484407",
        "Longitude": "-97.395395"
    },
    {
        "Latitude": "18.484910",
        "Longitude": "-97.394357"
    },
    {
        "Latitude": "18.485385",
        "Longitude": "-97.393490"
    },
    {
        "Latitude": "18.485870",
        "Longitude": "-97.392545"
    },
    {
        "Latitude": "18.486037",
        "Longitude": "-97.392220"
    },
    {
        "Latitude": "18.486380",
        "Longitude": "-97.391575"
    },
    {
        "Latitude": "18.486607",
        "Longitude": "-97.391145"
    },
    {
        "Latitude": "18.486830",
        "Longitude": "-97.390725"
    },
    {
        "Latitude": "18.487287",
        "Longitude": "-97.389855"
    },
    {
        "Latitude": "18.487737",
        "Longitude": "-97.388997"
    },
    {
        "Latitude": "18.488245",
        "Longitude": "-97.387990"
    },
    {
        "Latitude": "18.488222",
        "Longitude": "-97.386985"
    },
    {
        "Latitude": "18.488140",
        "Longitude": "-97.386342"
    },
    {
        "Latitude": "18.488165",
        "Longitude": "-97.386317"
    },
    {
        "Latitude": "18.488215",
        "Longitude": "-97.386327"
    },
    {
        "Latitude": "18.489195",
        "Longitude": "-97.386075"
    },
    {
        "Latitude": "18.489720",
        "Longitude": "-97.385145"
    },
    {
        "Latitude": "18.489635",
        "Longitude": "-97.384515"
    },
    {
        "Latitude": "18.488680",
        "Longitude": "-97.384510"
    },
    {
        "Latitude": "18.487742",
        "Longitude": "-97.384490"
    },
    {
        "Latitude": "18.487070",
        "Longitude": "-97.384542"
    },
    {
        "Latitude": "18.487065",
        "Longitude": "-97.384550"
    },
    {
        "Latitude": "18.487065",
        "Longitude": "-97.384550"
    },
    {
        "Latitude": "18.486790",
        "Longitude": "-97.384597"
    },
    {
        "Latitude": "18.485840",
        "Longitude": "-97.384530"
    },
    {
        "Latitude": "18.484832",
        "Longitude": "-97.384515"
    },
    {
        "Latitude": "18.483870",
        "Longitude": "-97.384490"
    },
    {
        "Latitude": "18.482835",
        "Longitude": "-97.384462"
    },
    {
        "Latitude": "18.482640",
        "Longitude": "-97.384455"
    },
    {
        "Latitude": "18.482642",
        "Longitude": "-97.384567"
    },
    {
        "Latitude": "18.482650",
        "Longitude": "-97.384577"
    },
    {
        "Latitude": "18.482572",
        "Longitude": "-97.385297"
    },
    {
        "Latitude": "18.482725",
        "Longitude": "-97.386255"
    },
    {
        "Latitude": "18.483562",
        "Longitude": "-97.386475"
    },
    {
        "Latitude": "18.483445",
        "Longitude": "-97.387407"
    },
    {
        "Latitude": "18.482677",
        "Longitude": "-97.387670"
    },
    {
        "Latitude": "18.482677",
        "Longitude": "-97.387665"
    },
    {
        "Latitude": "18.482677",
        "Longitude": "-97.387665"
    },
    {
        "Latitude": "18.482677",
        "Longitude": "-97.387665"
    },
    {
        "Latitude": "18.482520",
        "Longitude": "-97.387620"
    },
    {
        "Latitude": "18.481452",
        "Longitude": "-97.387870"
    },
    {
        "Latitude": "18.480400",
        "Longitude": "-97.388075"
    },
    {
        "Latitude": "18.479500",
        "Longitude": "-97.388252"
    },
    {
        "Latitude": "18.479350",
        "Longitude": "-97.387562"
    },
    {
        "Latitude": "18.479335",
        "Longitude": "-97.387532"
    },
    {
        "Latitude": "18.479317",
        "Longitude": "-97.387540"
    },
    {
        "Latitude": "18.479355",
        "Longitude": "-97.387555"
    },
    {
        "Latitude": "18.479435",
        "Longitude": "-97.387727"
    },
    {
        "Latitude": "18.478630",
        "Longitude": "-97.388090"
    },
    {
        "Latitude": "18.478627",
        "Longitude": "-97.388322"
    },
    {
        "Latitude": "18.478620",
        "Longitude": "-97.388372"
    },
    {
        "Latitude": "18.478542",
        "Longitude": "-97.389077"
    },
    {
        "Latitude": "18.477625",
        "Longitude": "-97.389352"
    },
    {
        "Latitude": "18.476640",
        "Longitude": "-97.389370"
    },
    {
        "Latitude": "18.475640",
        "Longitude": "-97.389325"
    },
    {
        "Latitude": "18.474570",
        "Longitude": "-97.389307"
    },
    {
        "Latitude": "18.473640",
        "Longitude": "-97.389387"
    },
    {
        "Latitude": "18.473042",
        "Longitude": "-97.390255"
    },
    {
        "Latitude": "18.472917",
        "Longitude": "-97.390530"
    },
    {
        "Latitude": "18.472885",
        "Longitude": "-97.390575"
    },
    {
        "Latitude": "18.472795",
        "Longitude": "-97.390535"
    },
    {
        "Latitude": "18.472780",
        "Longitude": "-97.390535"
    },
    {
        "Latitude": "18.473182",
        "Longitude": "-97.390075"
    },
    {
        "Latitude": "18.473790",
        "Longitude": "-97.389200"
    },
    {
        "Latitude": "18.474380",
        "Longitude": "-97.388335"
    },
    {
        "Latitude": "18.474930",
        "Longitude": "-97.387525"
    },
    {
        "Latitude": "18.475477",
        "Longitude": "-97.386855"
    },
    {
        "Latitude": "18.475520",
        "Longitude": "-97.386775"
    },
    {
        "Latitude": "18.475520",
        "Longitude": "-97.386775"
    },
    {
        "Latitude": "18.475520",
        "Longitude": "-97.386775"
    },
    {
        "Latitude": "18.475535",
        "Longitude": "-97.386685"
    },
    {
        "Latitude": "18.476100",
        "Longitude": "-97.385897"
    },
    {
        "Latitude": "18.476150",
        "Longitude": "-97.384925"
    },
    {
        "Latitude": "18.476125",
        "Longitude": "-97.383907"
    },
    {
        "Latitude": "18.475797",
        "Longitude": "-97.383190"
    },
    {
        "Latitude": "18.475297",
        "Longitude": "-97.382750"
    },
    {
        "Latitude": "18.474965",
        "Longitude": "-97.381927"
    },
    {
        "Latitude": "18.474435",
        "Longitude": "-97.381700"
    },
    {
        "Latitude": "18.474420",
        "Longitude": "-97.381680"
    },
    {
        "Latitude": "18.474425",
        "Longitude": "-97.381690"
    },
    {
        "Latitude": "18.474065",
        "Longitude": "-97.381635"
    },
    {
        "Latitude": "18.473372",
        "Longitude": "-97.381322"
    },
    {
        "Latitude": "18.473407",
        "Longitude": "-97.380270"
    },
    {
        "Latitude": "18.473450",
        "Longitude": "-97.379252"
    },
    {
        "Latitude": "18.473475",
        "Longitude": "-97.378212"
    },
    {
        "Latitude": "18.473235",
        "Longitude": "-97.377435"
    },
    {
        "Latitude": "18.472507",
        "Longitude": "-97.377120"
    },
    {
        "Latitude": "18.472305",
        "Longitude": "-97.376227"
    },
    {
        "Latitude": "18.471280",
        "Longitude": "-97.376220"
    },
    {
        "Latitude": "18.470505",
        "Longitude": "-97.376330"
    },
    {
        "Latitude": "18.470550",
        "Longitude": "-97.376322"
    },
    {
        "Latitude": "18.470540",
        "Longitude": "-97.376325"
    },
    {
        "Latitude": "18.470550",
        "Longitude": "-97.376457"
    },
    {
        "Latitude": "18.470360",
        "Longitude": "-97.377367"
    },
    {
        "Latitude": "18.469412",
        "Longitude": "-97.377542"
    },
    {
        "Latitude": "18.469227",
        "Longitude": "-97.378520"
    },
    {
        "Latitude": "18.469305",
        "Longitude": "-97.379545"
    },
    {
        "Latitude": "18.469300",
        "Longitude": "-97.380620"
    },
    {
        "Latitude": "18.469340",
        "Longitude": "-97.381685"
    },
    {
        "Latitude": "18.469330",
        "Longitude": "-97.382665"
    },
    {
        "Latitude": "18.469230",
        "Longitude": "-97.383685"
    },
    {
        "Latitude": "18.469217",
        "Longitude": "-97.383917"
    },
    {
        "Latitude": "18.469235",
        "Longitude": "-97.383915"
    },
    {
        "Latitude": "18.469287",
        "Longitude": "-97.384015"
    },
    {
        "Latitude": "18.468610",
        "Longitude": "-97.383980"
    },
    {
        "Latitude": "18.467915",
        "Longitude": "-97.383717"
    },
    {
        "Latitude": "18.467910",
        "Longitude": "-97.383497"
    },
    {
        "Latitude": "18.467905",
        "Longitude": "-97.383485"
    },
    {
        "Latitude": "18.467895",
        "Longitude": "-97.383490"
    },
    {
        "Latitude": "18.467802",
        "Longitude": "-97.382662"
    },
    {
        "Latitude": "18.466952",
        "Longitude": "-97.382790"
    },
    {
        "Latitude": "18.466945",
        "Longitude": "-97.383480"
    },
    {
        "Latitude": "18.466942",
        "Longitude": "-97.383487"
    },
    {
        "Latitude": "18.466960",
        "Longitude": "-97.383865"
    },
    {
        "Latitude": "18.466527",
        "Longitude": "-97.384535"
    },
    {
        "Latitude": "18.465502",
        "Longitude": "-97.384590"
    },
    {
        "Latitude": "18.464465",
        "Longitude": "-97.384675"
    },
    {
        "Latitude": "18.463507",
        "Longitude": "-97.384755"
    },
    {
        "Latitude": "18.462680",
        "Longitude": "-97.384567"
    },
    {
        "Latitude": "18.462627",
        "Longitude": "-97.383467"
    },
    {
        "Latitude": "18.462415",
        "Longitude": "-97.382580"
    },
    {
        "Latitude": "18.461582",
        "Longitude": "-97.382590"
    },
    {
        "Latitude": "18.461465",
        "Longitude": "-97.382615"
    },
    {
        "Latitude": "18.460455",
        "Longitude": "-97.382562"
    },
    {
        "Latitude": "18.459510",
        "Longitude": "-97.382632"
    },
    {
        "Latitude": "18.458575",
        "Longitude": "-97.382717"
    },
    {
        "Latitude": "18.458342",
        "Longitude": "-97.381772"
    },
    {
        "Latitude": "18.458187",
        "Longitude": "-97.380780"
    },
    {
        "Latitude": "18.458000",
        "Longitude": "-97.379777"
    },
    {
        "Latitude": "18.457917",
        "Longitude": "-97.379745"
    },
    {
        "Latitude": "18.457980",
        "Longitude": "-97.379745"
    },
    {
        "Latitude": "18.458105",
        "Longitude": "-97.379660"
    },
    {
        "Latitude": "18.457917",
        "Longitude": "-97.379740"
    },
    {
        "Latitude": "18.457917",
        "Longitude": "-97.379740"
    },
    {
        "Latitude": "18.457917",
        "Longitude": "-97.379740"
    },
    {
        "Latitude": "18.545688",
        "Longitude": "-97.503848"
    },
    {
        "Latitude": "18.457870",
        "Longitude": "-97.379780"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    },
    {
        "Latitude": "18.457945",
        "Longitude": "-97.379702"
    }
]


app.get('/mapaRuta', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Mapa con ruta</title>
            <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCkF9dXkDa3GjKlrLUdLc7BEx5031MELDQ&callback=initMap" async defer></script>
        </head>
        <body>
            <div id="map" style="height: 100%; width: 100%;"></div>
            <script>
                var ruta = ${JSON.stringify(ruta)};
                var map;
                var rutaIndex = 0;
                var path;

                function initMap() {
                    map = new google.maps.Map(document.getElementById("map"), {
                        zoom: 14,
                        center: { lat: 18.451660, lng: -97.398060 }
                    });

                    path = new google.maps.Polyline({
                        geodesic: true,
                        strokeColor: "#FF0000",
                        strokeOpacity: 1.0,
                        strokeWeight: 2
                    });

                    dibujarRuta();
                    mostrarUbicaciones();
                }

                function dibujarRuta() {
                    var pathCoordinates = [];
                    for (var i = 0; i < 20 && (rutaIndex + i) < ruta.length; i++) {
                        pathCoordinates.push({
                            lat: parseFloat(ruta[rutaIndex + i].Latitude),
                            lng: parseFloat(ruta[rutaIndex + i].Longitude)
                        });
                        console.log("Elemento mostrado:", ruta[rutaIndex + i]);
                    }
                    path.setPath(pathCoordinates);
                    path.setMap(map);
                    rutaIndex++;
                    if (rutaIndex + 20 < ruta.length) {
                        setTimeout(dibujarRuta, 1000);
                    }
                }

            </script>
        </body>
        </html>
    `);
});










//Clases de la version anterior de mensajes jeje

function EliminarMensaje(id) {
    const query = "UPDATE mensajes SET status = 0 WHERE ID_mensaje = ?";
    connection.query(query, [id], (error, results) => {
        if (error) {
            console.error("Error al ejecutar la consulta:", error);
            return;
        }
        console.log("Se elimino el mensaje");
        TomarMensajesDeBD()
            .then(mensajes => {
                // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
                const mensajesGuardados = mensajes;
                //  console.log("Mensajes guardados:", mensajesGuardados);
                io.sockets.emit("chat:message", mensajesGuardados);
            })
            .catch(error => {
                // Maneja cualquier error que pueda ocurrir durante la consulta
                console.error("Error al tomar los mensajes de la base de datos:", error);
            });
    });

}





function EditarMensaje(titulo, mensaje, id) {
    const query = "UPDATE mensajes SET titulo = ?, cuerpo = ? WHERE ID_mensaje = ?";
    connection.query(query, [titulo, mensaje, id], (error, results) => {
        if (error) {
            console.error("Error al ejecutar la consulta:", error);
            return;
        }
        console.log("Se corrigio el mensaje");
        TomarMensajesDeBD()
            .then(mensajes => {
                // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
                const mensajesGuardados = mensajes;
                //  console.log("Mensajes guardados:", mensajesGuardados);
                io.sockets.emit("chat:message", mensajesGuardados);
            })
            .catch(error => {
                // Maneja cualquier error que pueda ocurrir durante la consulta
                console.error("Error al tomar los mensajes de la base de datos:", error);
            });
    });

}




function EnviarDatosABD(titulo, mensajeTomado, socket) {
    const query = "INSERT INTO mensajes (titulo, cuerpo) VALUES (?, ?)";
    connection.query(query, [titulo, mensajeTomado], (error, results) => {
        if (error) {
            console.error("Error al ejecutar la consulta:", error);
            return;
        }
        console.log("Se agrego el mensaje a la bd");

        socket.emit("MensajeSubido");
    });

    TomarMensajesDeBD()
        .then(mensajes => {
            // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
            const mensajesGuardados = mensajes;
            //  console.log("Mensajes guardados:", mensajesGuardados);
            io.sockets.emit("chat:message", mensajesGuardados);
        })
        .catch(error => {
            // Maneja cualquier error que pueda ocurrir durante la consulta
            console.error("Error al tomar los mensajes de la base de datos:", error);
        });

}

function TomarMensajesDeBD() {
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM mensajes WHERE status = 1";

        connection.query(query, (error, results) => {
            if (error) {
                console.error("Error al ejecutar la consulta:", error);
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}


console.log("Servidor en el puerto 3000");






















