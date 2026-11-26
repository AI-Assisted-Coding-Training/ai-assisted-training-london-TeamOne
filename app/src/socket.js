export function connectRoom({ url, onOpen, onMessage, onClose }) {
  const socket = new WebSocket(url);
  socket.addEventListener('open', onOpen);
  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    onMessage(message);
  });
  socket.addEventListener('close', onClose);

  return {
    send(message) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    close() {
      if (socket.readyState < WebSocket.CLOSING) socket.close(1000, 'left_room');
    },
  };
}
