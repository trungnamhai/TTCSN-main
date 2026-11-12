const socketUsers = new Map();
const userSockets = new Map();

function addSocket(socketId, user) {
  socketUsers.set(socketId, user);
  if (!userSockets.has(user.username)) {
    userSockets.set(user.username, new Set());
  }
  userSockets.get(user.username).add(socketId);
  return userSockets.get(user.username).size === 1;
}

function removeSocket(socketId) {
  const user = socketUsers.get(socketId);
  if (!user) return null;

  socketUsers.delete(socketId);
  const sockets = userSockets.get(user.username);
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(user.username);
    return { ...user, isOnline: false };
  }
  return null;
}

function isOnline(username) {
  return userSockets.has(username);
}

function getOnlineStudentUsernames() {
  return [...userSockets.entries()]
    .filter(([, sockets]) => sockets.size > 0)
    .map(([username]) => username);
}

module.exports = {
  addSocket,
  removeSocket,
  isOnline,
  getOnlineStudentUsernames
};
