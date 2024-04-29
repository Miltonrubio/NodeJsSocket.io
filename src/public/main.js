const socket = io();

const noteForm = document.querySelector("#formNote");
const tituloMensaje = document.querySelector("#title");
const descrip = document.querySelector("#descrip");



const contenedorNotas =  document.getElementById("notes");

socket.on('chat:message', function (mensajes){
    console.log(mensajes); 
    contenedorNotas.innerHTML = ""

    mensajes.forEach(function(mensaje) {
        contenedorNotas.innerHTML += `
        <div class="card card-content mb-2 ">
        <h4 class="titulo text-primary"> ${mensaje.titulo}</h4>

        <p>${mensaje.cuerpo} </p>
        </div>
        `;
    });
});














noteForm.addEventListener("submit", (e) => {
  e.preventDefault();

  console.log();

  socket.emit("client:newMessage", {
   mensaje: descrip.value, 
  titulo:  tituloMensaje.value
  })




});



socket.on ("MensajeSubido", () =>{

    console.log("Se subió el mensaje")

})