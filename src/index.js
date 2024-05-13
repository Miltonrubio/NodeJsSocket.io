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


/*

app.use(session({
  secret: 'secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }
}));






app.get('/cerrar-sesion', (req, res) => {
  // Destruir la sesión
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      res.send('Error al cerrar sesión');
    } else {
      res.send('Sesión cerrada');
    }
  });
});

*/

app.use(express.static(__dirname + "/public"));


app.post('/inicio', (req, res) => {
  const { username } = req.body;
  req.session.usuario = username;
  res.redirect('/');
});

/*

function validarSesion(req, res, next) {
  if (!req.session.usuario || req.session.usuario != '') {

    console.log("No hay sesion ")
    return res.redirect('/login.html');
  } else {
    console.log("Si hay sesion ")
    next();
  }
}

*/


// Rutas protegidas por la validación de sesión
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

//app.listen(3000)
httpServer.listen(3000);



io.on("connection", (socket) => {
  console.log("Nueva visita de ubicaciones");

  // Llamar a la función inicialmente al conectar
  TomarYEnviarUbicaciones();

  // Llamar a la función cada 30 segundos
//  const intervalo = setInterval(TomarYEnviarUbicaciones, 30000);
  const intervalo = setInterval(TomarYEnviarUbicaciones, 1000);

  // Manejar desconexión del socket para detener el intervalo cuando no hay conexiones
  socket.on("disconnect", () => {
    clearInterval(intervalo);
    console.log("Se ha desconectado el cliente");
  });
});

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

function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicaciones => {
      const ubicacionesGuardados = ubicaciones;
      io.sockets.emit("ubi:show", ubicacionesGuardados);
  
      
      ubicacionesGuardados.forEach(ubicacion => {
        const latitud = parseFloat(ubicacion.Latitude);
        const longitud = parseFloat(ubicacion.Longitude);
        const velocidad = parseFloat(ubicacion.Speed); // Obtener velocidad de la ubicación
        verificarCercaniaDestino(latitud, longitud, velocidad);
      });
      

      /*
      // Verificar cercanía al destino para cada ubicación
      ubicacionesGuardados.forEach(ubicacion => {
        const latitud = parseFloat(ubicacion.Latitude);
        const longitud = parseFloat(ubicacion.Longitude);
        verificarCercaniaDestino(latitud, longitud);
      });
*/

    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}


function TomarUbicacionesPorRatos() {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM ubicaciones_forma ORDER BY ID DESC limit 5";

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



const distanciaEntrePuntos = (lat1, lon1, lat2, lon2) => {
  const radioTierra = 6371; // Radio de la Tierra en kilómetros
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distancia = radioTierra * c; // Distancia en kilómetros
  return distancia;
}

// Coordenadas de destino
const destinoLat = 18.445694;
const destinoLon = -97.404463;
//18.445694, -97.404463


/*
// Función para verificar si estamos cerca del destino
const verificarCercaniaDestino = (lat, lon) => {
  const distancia = distanciaEntrePuntos(lat, lon, destinoLat, destinoLon);
  if (distancia <= 0.1) { // Ajusta este valor según la cercanía deseada en kilómetros
      console.log("¡Estas cerca de casa!");
  }
}
*/

const verificarCercaniaDestino = (lat, lon, velocidadKmh) => {
  const distancia = distanciaEntrePuntos(lat, lon, destinoLat, destinoLon);
  const tiempoHoras = distancia / velocidadKmh; // Tiempo en horas

  // Convertir horas a minutos y segundos
  const tiempoMinutos = tiempoHoras * 60;
  const tiempoSegundos = tiempoMinutos * 60;

  if (distancia <= 0.1) { // Ajusta este valor según la cercanía deseada en kilómetros
    console.log("¡Estás cerca de casa!");
  } else {
    console.log(`Tiempo estimado de llegada: ${tiempoHoras.toFixed(2)} horas (${tiempoMinutos.toFixed(2)} minutos / ${tiempoSegundos.toFixed(2)} segundos)`);
  }
}






/*
io.on("connection", (socket) => {
  console.log("Nueva conexion");



  // Llama a la función para tomar los mensajes y maneja el resultado
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


  socket.on("client:newMessage", (data) => {
    const titulo = data.titulo;
    const mensajeTomado = data.mensaje;

    EnviarDatosABD(titulo, mensajeTomado, socket);


  });

  socket.on("client:editarMensaje", (data) => {
    const titulo = data.titulo;
    const mensaje = data.mensaje;
    const id = data.id;

    EditarMensaje(titulo, mensaje, id)
  });




  socket.on("client:eliminarMensaje", (data) => {
    const id = data.id;

    EliminarMensaje(id)
  });



});

*/

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






















