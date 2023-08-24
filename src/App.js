import Button from "@material-ui/core/Button"
import IconButton from "@material-ui/core/IconButton"
import TextField from "@material-ui/core/TextField"
import AssignmentIcon from "@material-ui/icons/Assignment"
import PhoneIcon from "@material-ui/icons/Phone"
import React, { useEffect, useRef, useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import Peer from "simple-peer"
import io from "socket.io-client"
import "./App.css"


const socket = io.connect('http://localhost:5000')//Establecemos que eres un cliente
function App() {
	const [ me, setMe ] = useState("")
	const [ stream, setStream ] = useState()
	const [ receivingCall, setReceivingCall ] = useState(false)
	const [ caller, setCaller ] = useState("")
	const [ callerSignal, setCallerSignal ] = useState()
	const [ callAccepted, setCallAccepted ] = useState(false)
	const [ idToCall, setIdToCall ] = useState("")
	const [ callEnded, setCallEnded] = useState(false)
	const [ name, setName ] = useState("")
	const myVideo = useRef()
	const userVideo = useRef()
	const connectionRef= useRef()

	useEffect(() => {
		navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
			setStream(stream)
			myVideo.current.srcObject = stream
		})
		//Recibir un mensaje del servidor (recibo el id unico para identificarme)
		socket.on("me", (id) => {
			setMe(id)
		})
		//Recibir un mensaje del servidor, en este caso se ejecutará desde el cliente A.
		socket.on("callUser", (data) => {
			console.log('data ',data)
			setReceivingCall(true)
			setCaller(data.from)//Cliente B
			setName(data.name)
			setCallerSignal(data.signal)
		})
	}, [])

	//El id viene a ser la cadena generada por el otro usuario que desea hablar contigo 
	const callUser = (id) => {
		const peer = new Peer({
			initiator: true,
			trickle: false,
			stream: stream
		})
	/*
	El evento "signal" en la biblioteca Simple-Peer de WebRTC se dispara cuando la instancia de Peer ha generado 
	un objeto de señalización que debe ser compartido con el otro extremo (peer) para establecer la conexión P2P. 
	La señalización es un proceso que involucra el intercambio de información entre los pares para negociar y establecer la conexión.
	La instancia de Peer ha generado un objeto de señalización, el evento "signal" se activará y la función de devolución de llamada 
	pasada como argumento se ejecutará. Puedes enviar el objeto de señalización a la otra parte (peer) a través de un canal de comunicación 
	(por ejemplo, WebSocket) para que puedan usarlo en la negociación de la conexión.
	*/
		peer.on("signal", (data) => {
			socket.emit("callUser", {//Envia un evento a ws desde Cliente B hacia el cliente A.
				userToCall: id,//Le llegará el mensaje al usuario que tenga este id (el que realizo la peticion
				//de hablar con nostros) - cliente A
				//Datos del usuario Cliente B
				signalData: data,
				from: me,
				name: name
			})
		})
		peer.on("stream", (stream) => {
			
				userVideo.current.srcObject = stream
			
		})
		//Este metodo se va a ejecutar cuando el otro usuario A, acepte la solicitud de llamado observar la línea
		// socket.emit("answerCall", { signal: data, to: caller }) esta linea envia un evento al server, pero a su vez el server 
		// producto de ejecutar este evento envia 
		socket.on("callAccepted", (signal) => {
			setCallAccepted(true)
			peer.signal(signal)
		})

		connectionRef.current = peer
	}

	const answerCall =() =>  {
		setCallAccepted(true)
		const peer = new Peer({
			initiator: false,
			trickle: false,
			stream: stream
		})
		peer.on("signal", (data) => {
			socket.emit("answerCall", { signal: data, to: caller })
		})
		peer.on("stream", (stream) => {
			userVideo.current.srcObject = stream
		})

		peer.signal(callerSignal)
		connectionRef.current = peer
	}

	const leaveCall = () => {
		setCallEnded(true)
		connectionRef.current.destroy()
	}

	return (
		<>
			<h1 style={{ textAlign: "center", color: '#fff' }}>Zoomish</h1>
		<div className="container">
			<div className="video-container">
				<div className="video">
					{stream &&  <video playsInline muted ref={myVideo} autoPlay style={{ width: "300px" }} />}
				</div>
				<div className="video">
					{callAccepted && !callEnded ?
					<video playsInline ref={userVideo} autoPlay style={{ width: "300px"}} />:
					null}
				</div>
			</div>
			<div className="myId">
				<TextField
					id="filled-basic"
					label="Name"
					variant="filled"
					value={name}
					onChange={(e) => setName(e.target.value)}
					style={{ marginBottom: "20px" }}
				/>
				<CopyToClipboard text={me} style={{ marginBottom: "2rem" }}>
					<Button variant="contained" color="primary" startIcon={<AssignmentIcon fontSize="large" />}>
						Copy ID
					</Button>
				</CopyToClipboard>

				<TextField
					id="filled-basic"
					label="ID to call"
					variant="filled"
					value={idToCall}
					onChange={(e) => setIdToCall(e.target.value)}
				/>
				<div className="call-button">
					{callAccepted && !callEnded ? (
						<Button variant="contained" color="secondary" onClick={leaveCall}>
							End Call
						</Button>
					) : (
						//Aceptar la llamada al usuario que genero el id 
						<IconButton color="primary" aria-label="call" onClick={() => callUser(idToCall)}>
							<PhoneIcon fontSize="large" />
						</IconButton>
					)}
					{idToCall}
				</div>
			</div>
			<div>
				{receivingCall && !callAccepted ? (
						<div className="caller">
						<h1 >{name} is calling...</h1>
						<Button variant="contained" color="primary" onClick={answerCall}>
							Answer
						</Button>
					</div>
				) : null}
			</div>
		</div>
		</>
	)
}

export default App
