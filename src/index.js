console.log("Conectado");

import { Server as WebSocketServer } from "socket.io";
import express from "express";
import http from "http";
const connection = require("./bdconfig");

const app = express();
const httpServer = http.createServer(app);
const io = new WebSocketServer(httpServer);

app.use(express.static(__dirname + "/public"));

app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//app.listen(3000)
httpServer.listen(3000);



io.on("connection", (socket) => {
  console.log("Nueva conexion");
/*
 const mensajes = TomarMensajesDeBD();
  io.sockets.emit("chat:message", mensajes);
*/


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
});

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
      const query = "SELECT * FROM mensajes";
  
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
