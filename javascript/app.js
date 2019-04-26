 //////////////////////////////////////////////////////////////////////////////
 // rps-game/javascript/app.js
 // Rock-paper-scissors game using Firebase
 //
 // 0004 Wednesday, 5 Nisan 5779 (10 April 2019) [EDT] {17996}
 //
 // University of Richmond Coding Boot Camp run by Trilogy Education Services
 // Austin Kim
 //
 // Modified:
 //   2035 Saturday, 15 Nisan 5779 (20 April 2019) [EDT] {18006}
 //   2015 Sunday, 16 Nisan 5779 (21 April 2019) [EDT] {18007}
 //   2145 Monday, 17 Nisan 5779 (22 April 2019) [EDT] {18008}
 //   2320 Wednesday, 19 Nisan 5779 (24 April 2019) [EDT] {18010}
 //   2301 Thursday, 20 Nisan 5779 (25 April 2019) [EDT] {18011}
 //   0223 Friday, 21 Nisan 5779 (26 April 2019) [EDT] {18012}
 //////////////////////////////////////////////////////////////////////////////

 // Global constants
const MessageLimit = 10                  // No./most recent messages to display
const Timeout = 5                        // Timeout between rounds (in seconds)

 // Global variables

var p1name                               // Player name
var p2name                               // Opponent name
var p1score                              // Player score
var p2score                              // Opponent score
 // Game state:     0 = Selecting player name and opponent to play
 //                 1 = Waiting for potential opponent to accept
 //                 2 = Waiting for player to throw
 //                 3 = Waiting for opponent to throw
 //                 4 = Round over; waiting for timeout 'til next round
var state = 0    // 5 = Opponent has disconnected; game ended
var round                                // Round no. in current game
 // Throws:  0 = rock, 1 = paper, 2 = scissors
const Throws = ['ROCK', 'PAPER', 'SCISSORS']
var p1throw                              // Player's throw
var p2throw                              // Opponent's throw
 // Available users to play
var users = {}
 // State 4 timeout
var timeout

 // Firebase variables

var firebaseConfig = {
  apikey: 'fnU5xTfnWmrtyrcs8f6wQvpS7LvBXsABrWHQzWR',
  authDomain: 'test-eabb1.firebaseapp.com',
  databaseURL: 'https://test-eabb1.firebaseio.com',
  projectId: 'test-eabb1',
  storageBucket: 'test-eabb1.appspot.com',
  messagingSenderId: '681019465124'}
var database                             // Firebase database
var connectionsRef                       // Firebase /connections node
var connectedRef                         // Firebase .info/connected node
var p1key = ''                           // Our key ID (null if not connected)
var p2key = ''                           // Opponent key ID (null if none)
var p1connectionRef                      // Firebase /connections/${p1key}
var p1p2subnodeRef                       // Firebase ...tions/${p1key}/${p2key}
var p2connectionRef                      // Firebase /connections/${p2key}
var p2p1subnodeRef                       // Firebase ...tions/${p2key}/${p1key}

 // Rock-paper-scissors arrays are values of 0 (rock), 1 (paper), 2 (scissors)
var rps1array                            // Player rock-paper-scissors array
var rps2array                            // Opponent rock-paper-scissors array

 // Chat messages are arrays of {timestamp, message} pairs,
 //   which we keep pruned to the MessageLimit total most recent chat messages
var p1chats                              // Player chat messages
var p2chats                              // Opponent chat messages

 // Chats array of MessageLimit most recent chat messages
var earliestTime                         // UNIX timestamp of MessageLimit-th
                                         //   most recent chat message (used to
                                         //   prune p1chats[] and p2chats[])

 // Game play global variables (used in states 2--4)
var p2availableRef
var p2messagesRef
 // Game play global variable (used in state 3)
var p2rpsArrayRef

 //////////////////////////////////////////////////////////////////////////////
 // Firebase database structure
 //////////////////////////////////////////////////////////////////////////////

 // connections: [
 //   playerKey: {
 //     name: playerName,
 //     available: true/false,
 //     opponentKey: {
 //       rpsArray[of 0 = rock, 1 = paper, 2 = scissors],
 //       messages: [
 //         {unixTimeStamp: message}
 //         ...]
 //       }
 //     },
 //   playerKey2: ...
 //   ]

 //////////////////////////////////////////////////////////////////////////////
 // Game state 0 = Selecting player name and opponent to play
 //////////////////////////////////////////////////////////////////////////////

 // Reset modal OK button callback function
$('#resetOK').click(function() {
  var input = $('#name').val()
  input = input.trim()
  if (input.length < 1 || input.length > 16)
    $('.helper-text').attr('data-error',
      'Player name must be between 1 and 16 characters.')
    else {
   // Connect to Firebase, and validate name for uniqueness
      database = firebase.database()
      connectedRef = database.ref('.info/connected')
      connectionsRef = database.ref('connections')
   // Add ourself to /connections
   // Must use connectedRef.on(), not connectedRef.once()
      connectedRef.on('value', function(snapshot) {
        if (snapshot.val()) {
   // Here, using connectionsRef.once() is sufficient (only need to run once)
          connectionsRef.once('value', function(snapshot) {
            var unique = true
            snapshot.forEach(function(childSnapshot) {
              var childData = childSnapshot.val()
              unique &=
                input.toLowerCase() !== childData.name.trim().toLowerCase()
              return})
            if (unique) {
              p1name = input
              p1connectionRef =
                connectionsRef.push({name: p1name, available: true})
              p1key = p1connectionRef.key
              p1connectionRef.onDisconnect().remove()
              $('#resetModal').modal('close')
           // Reset helper-texts for next time
              $('.helper-text').attr('data-error',
                'Player name must be between 1 and 16 characters.')
              $('.helper-text').removeAttr('data-success')
              $('#p1name').text(p1name)
           // Now open the new game modal
              $('#newGameModal').modal('open')}
                else $('.helper-text').attr('data-success',
                  'Player name is already in use.')
            return}) // connectionsRef.once('value'...
          } // if (snapshot.val())
        return}) // connectedRef.once('value'...
      } // else
  return})

 // getUsers(): Get list of available users to play
function getUsers() {
 // If we were previously playing an opponent, disconnect from that opponent
  if (p2key.length !== 0) {
    p1p2subnodeRef.remove()
    p2key = ''
    var p1availableRef = database.ref(`connections/${p1key}/available`)
    p1availableRef.set(true)}
 // Replace the connectedRef.once() function with one that not only keeps our
 //   connection alive, but also gets the list of available users to play
  connectedRef.off()
  connectedRef.on('value', function(snapshot) {
    if (snapshot.val()) {
      connectionsRef.on('value', function(snapshot) {
        users = {}
        var unique = true                // Used to see if we got disconnected
        snapshot.forEach(function(childSnapshot) {
          var childData = childSnapshot.val()
          if (p1name.toLowerCase() === childData.name.trim().toLowerCase())
            unique = false
            else if (childData.available) users[childData.name.trim()] = {
              key: childSnapshot.key,
              requesting: childSnapshot.child(p1key).exists()}
          return})
     // If p1name not be in /connections, we got disconnected, so reconnect
        if (unique) {
          p1connectionRef.set({name: p1name, available: true})
// Begin debug
console.log(`Adding ourself in getUsers():  p1key = ${p1key}`)
// End debug
          p1connectionRef.onDisconnect().remove()}
        var select = $('select')
        select.empty()
        var option = $('<option>')
          option.attr('disabled', 'disabled')
          option.attr('selected', 'selected')
          option.text('Select opponent')
        select.append(option)
        for (let name in users) {
          option = $('<option>')
          option.attr('value', name)
          if (users[name].requesting)
            option.text(name + ' - REQUESTING TO PLAY YOU')
            else option.text(name)
          $('select').append(option)}
     // Refresh <select> element
        $('select').formSelect()
        return}) // connectionsRef.on('value'...
      } // if (snapshot.val())
    return}) // connectedRef.on('value'...
  return}

 // updateChats():  Assemble chats[] from p1chats[] and p2chats[]; set
 //   earliestTime; and prune all three arrays to MessageLimit most recent
function updateChats() {
  var p1index = 0
  var p2index = 0
  var chats = []
  var chatsIndex = 0
  var time = 0
  var date
  var message
  while (p1index !== p1chats.length || p2index !== p2chats.length)
    if (p2index === p2chats.length || p1index !== p1chats.length &&
      p1chats[p1index].timestamp < p2chats[p2index].timestamp) {
      time = p1chats[p1index].timestamp
      date = new Date(time)
      message = date.getHours() < 10 ? `(0${date.getHours()}:`
                                     :  `(${date.getHours()}:`
      message += date.getMinutes() < 10 ? `0${date.getMinutes()}:`
                                        :  `${date.getMinutes()}:`
      message += date.getSeconds() < 10 ? `0${date.getSeconds()}`
                                        :  `${date.getSeconds()}`
      chats[chatsIndex++] = {
        time,
        message: `${message} ${p1name}:)  ${p1chats[p1index++].message}`}
      }
      else {
        time = p2chats[p2index].timestamp
        date = new Date(time)
        message = date.getHours() < 10 ? `(0${date.getHours()}:`
                                       :  `(${date.getHours()}:`
        message += date.getMinutes() < 10 ? `0${date.getMinutes()}:`
                                          :  `${date.getMinutes()}:`
        message += date.getSeconds() < 10 ? `0${date.getSeconds()}`
                                          :  `${date.getSeconds()}`
        chats[chatsIndex++] = {
          time,
          message: `${message} ${p2name}:)  ${p2chats[p2index++].message}`}
        }
  chatsIndex = Math.max(chats.length - MessageLimit, 0)
  earliestTime = chats[chatsIndex].time
 // Prune messages in chats[] earlier than earliestTime
  chats.splice(0, chatsIndex)
 // Prune messages in p1chats[] earlier than earliestTime
  for (p1index = 0; p1index !== p1chats.length && p1chats[p1index].timestamp <
    earliestTime; ++p1index)
  p1chats.splice(0, p1index)
 // Prune messages in p2chats[] earlier than earliestTime
  for (p2index = 0; p2index !== p2chats.length && p2chats[p2index].timestamp <
    earliestTime; ++p2index)
  p2chats.splice(0, p2index)
 // Display chats
  var div = $('#chats')
  var p
  div.empty()
  for (chatsIndex = 0; chatsIndex !== chats.length; ++chatsIndex) {
    p = $('<p>')
    p.text(chats[chatsIndex].message)
    div.append(p)}
  return}

 // New game modal OK button callback function
$('#newGameOK').click(function() {
 // Reset UI elements
  $('#p1score').text('-')
  $('#p2score').text('-')
  $('#p1throw').text('-')
  $('#p2throw').text('-')
  $('#p1status').text('-')
  $('#p2status').text('-')
  p2name = $('#opponent').val()
  if (p2name) {
    p2name = p2name.trim()
    p2key = users[p2name].key
    $('#p2name').text(p2name)
 // Initialize chats
    p1chats = []
    p2chats = []
    timestamp = Date.now()
    p1chats[0] = {
      timestamp,
      message: `[Requesting to play with ${p2name}]`}
 // Add connections.p1key.p2key.messages node to request to play with opponent
    var messageRef =
      database.ref(`connections/${p1key}/${p2key}/messages/${timestamp}`)
    messageRef.set(p1chats[0].message)
    $('#newGameModal').modal('close')
 // Disconnect the state 0 connections listener, and replace with the state 1
 //   listener (defined below)
    connectionsRef.off()
    connectedRef.off()
 // Update status messages as part of chats[]
    updateChats()
 // Transition to state 1
    attachState1listener()
    state = 1}
  return})

 //////////////////////////////////////////////////////////////////////////////
 // Game state 1 = Waiting for potential opponent to accept
 //////////////////////////////////////////////////////////////////////////////

function attachState1listener() {
 // Make p1:p2 subnode, p2connection, and p2:p1 subnode connection references
  p1p2subnodeRef = database.ref(`connections/${p1key}/${p2key}`)
  p2connectionRef = database.ref(`connections/${p2key}`)
  p2p1subnodeRef = database.ref(`connections/${p2key}/${p1key}`)
 // Attach state 1 listeners
  connectedRef.on('value', function(snapshot) {
    if (snapshot.val()) {
   // Attach state 1 p1connection listener
      p1connectionRef.on('value', function(snapshot) {
        if (!snapshot.exists()) {
       // We got disconnected, so reattach and reconstruct player's node
       //   (including opponent subnode under player's node)
          p1connectionRef.set({name: p1name, available: true})
          var p1p2messageRef
          for (let i = 0; i !== p1chats.length; ++i) {
            p1p2messageRef = database.ref(`connections/${p1key}/${p2key}` +
              `/messages/${p1chats[i].timestamp}`)
            p1p2messageRef.set(p1chats[i].message)}
          p1connectionRef.onDisconnect().remove()} // if (!snapshot.exists()
        return}) // p1connectionRef.on('value'...
   // Attach state 1 p2connection listener
      p2connectionRef.on('value', function(snapshot) {
        if (snapshot.exists()) {
          var snap = snapshot.val()
          if (snap[p1key]) {
         // Make player unavailable for other users besides opponent
            var p1availableRef = database.ref(`connections/${p1key}/available`)
            p1availableRef.set(false)
         // Connect
            var timestamp = Date.now()
            var message = `[${p1name} has accepted ${p2name}'s request]`
            p1chats.push({timestamp, message})
            var p1p2messageRef = database.ref(`connections/${p1key}/${p2key}` +
              `/messages/${timestamp}`)
            p1p2messageRef.set(message)
         // Display updated messages
            p2chats = []
            var p2messages = snap[p1key].messages
            for (let key in p2messages)
              p2chats.push({
                timestamp: parseInt(key),
                message: p2messages[key]})
            updateChats()
         // Disconnect the state 1 connections listeners, and transition to
         //   state 2
            p2connectionRef.off()
            p1connectionRef.off()
            connectedRef.off()
            initGame()
            state = 2}
          } // if (snapshot.exists())
        return}) // p2connectionRef.on('value'...
      } // if (snapshot.val())
    return}) // connectedRef.on('value'...
  return}

 //////////////////////////////////////////////////////////////////////////////
 // Game state 2 = Waiting for player to throw
 //////////////////////////////////////////////////////////////////////////////

function updateScore() {
  $('#p1score').text(p1score)
  $('#p2score').text(p2score)
  return}

function initGame() {
  p2score = p1score = 0
  updateScore()
  round = 0
  rps1array = []
  rps2array = []
  p2chats = []
  attachState2listeners()
  return}

function attachState2listeners() {
 // Attach state 2 listeners
  connectedRef.on('value', function(snapshot) {
    if (snapshot.val()) {
   // Attach state 2--4 p1connection listener
      p1connectionRef.on('value', function(snapshot) {
        if (!snapshot.exists()) {
       // We got disconnected, so reattach and reconstruct player's node
       //   (including opponent subnode under player's node)
          p1connectionRef.set({name: p1name, available: false,
            rpsArray: rps1array})
          var p1p2messageRef
          for (let i = 0; i !== p1chats.length; ++i) {
            p1p2messageRef = database.ref(`connections/${p1key}/${p2key}` +
              `/messages/${p1chats[i].timestamp}`)
            p1p2messageRef.set(p1chats[i].message)}
          p1connectionRef.onDisconnect().remove()} // if (!snapshot.exists)
        return}) // p1connectionRef.on('value'...
   // Attach state 2--4 p2messages listener
      p2messagesRef = database.ref(`connections/${p2key}/${p1key}/messages`)
      p2messagesRef.on('value', function(snapshot) {
     // Only update p2chats[] if we successfully retrieved messages/
        if (snapshot.exists()) {
          p2chats = []
          snapshot.forEach(function(childSnapshot) {
            p2chats.push({timestamp: parseInt(childSnapshot.key),
              message: childSnapshot.val()})
            return}) // snapshot.forEach(...)
          updateChats()}
        return}) // p2messagesRef.on('value'...
      } // if (snapshot.val())
    return}) // connectedRef.on('value'...
 // Prompt for player to throw
  $('#p1throw').text('-')
  $('#p2throw').text('-')
  $('#p1status').text('Your turn')
  $('#p2status').empty()
  return}

 // updateThrow():  Apply player's throw
function updateThrow() {
  rps1array[round] = p1throw
  var p1rpsArrayRef = database.ref(`connections/${p1key}/${p2key}/rpsArray`)
  p1rpsArrayRef.set(rps1array)
  $('#p1status').empty()
  $('#p2status').text(`Waiting on ${p2name}`)
 // Disconnect the state 2 connections listeners, and transition to state 3
  p2messagesRef.off()
  p1connectionRef.off()
  connectedRef.off()
  state = 3
  attachState3listeners()
  return}

 //////////////////////////////////////////////////////////////////////////////
 // Game state 3 = Waiting for opponent to throw
 //////////////////////////////////////////////////////////////////////////////

function attachState3listeners() {
 // Attach state 3 listeners
  connectedRef.on('value', function(snapshot) {
    if (snapshot.val()) {
   // Attach state 2--4 p1connection listener
      p1connectionRef.on('value', function(snapshot) {
        if (!snapshot.exists()) {
       // We got disconnected, so reattach and reconstruct player's node
       //   (including opponent subnode under player's node)
          p1connectionRef.set({name: p1name, available: false,
            rpsArray: rps1array})
          var p1p2messageRef
          for (let i = 0; i !== p1chats.length; ++i) {
            p1p2messageRef = database.ref(`connections/${p1key}/${p2key}` +
              `/messages/${p1chats[i].timestamp}`)
            p1p2messageRef.set(p1chats[i].message)}
          p1connectionRef.onDisconnect().remove()} // if (!snapshot.exists)
        return}) // p1connectionRef.on('value'...
   // Attach state 2--4 p2messages listener
      p2messagesRef = database.ref(`connections/${p2key}/${p1key}/messages`)
      p2messagesRef.on('value', function(snapshot) {
     // Only update p2chats[] if we successfully retrieved messages/
        if (snapshot.exists()) {
          p2chats = []
          snapshot.forEach(function(childSnapshot) {
            p2chats.push({timestamp: parseInt(childSnapshot.key),
              message: childSnapshot.val()})
            return}) // snapshot.forEach(...)
          updateChats()}
        return}) // p2messagesRef.on('value'...
   // Attach state 3 p2rpsArray listener
      p2rpsArrayRef = database.ref(`connections/${p2key}/${p1key}/rpsArray`)
      p2rpsArrayRef.on('value', function(snapshot) {
        if (snapshot.exists()) {
          rps2array = snapshot.val()
          if (state === 3 && rps2array.length === round + 1) {
         // Disable conditions for this code immediately to prevent race condi.
            state = 4
            p2rpsArrayRef.off()
         // Now figure out who won, and update scores accordingly
            $('#p2status').empty()
            p2throw = rps2array[round]
            $('#p2throw').text(Throws[p2throw])
            switch ((p1throw + 3 - p2throw) % 3) {
              case 0:                    // Tie
                $('#p1status').text('You tie')
                $('#p2status').text('You tie')
                p1score += 0.5
                p2score += 0.5
                break
              case 1:                    // Player 1 wins
                $('#p1status').text('You win')
                ++p1score
                break
              case 2:                    // Player 2 wins
                $('#p2status').text(`${p2name} wins`)
                ++p2score
                }
            updateScore()
            ++round
            clearTimeout(timeout)
            timeout = setTimeout(timeoutExpired, 1000 * Timeout)} // if
          } // if (snapshot.exists())
        return}) // p2rpsArray.on('value'...
   // Attach state 3--4 p2available listener
      p2availableRef = database.ref(`connections/${p2key}/available`)
      p2availableRef.on('value', function(snapshot) {
        if (snapshot.val()) {            // Opponent has disconnected from game
          clearTimeout(timeout)
          $('#p2status').text('Disconnected')
          var timestamp = Date.now()
          var message = `[${p2name} has disconnected]`
          p1chats.push({timestamp, message})
          updateChats()
       // Disconnect state 3 listeners, and transition to state 5
          p2availableRef.off()
          p2rpsArrayRef.off()
          p2messagesRef.off()
          state = 5
          suspend()} // if (snapshot.val())
        return}) // p2availableRef.on('value'...
      } // if (snapshot.val())
    return}) // connectedRef.on('value'...
  return}

 //////////////////////////////////////////////////////////////////////////////
 // Game state 4 = Round over; waiting for timeout 'til next round
 //////////////////////////////////////////////////////////////////////////////

 // timeoutExpired():  Callback function called when state 4 timeout expires
function timeoutExpired() {
  clearTimeout(timeout)
 // Disconnect state 3--4 listeners, and transition to state 2
  p2availableRef.off()
  p2messagesRef.off()
  p1connectionRef.off()
  connectedRef.off()
  state = 2
  attachState2listeners()
  return}

 //////////////////////////////////////////////////////////////////////////////
 // Game state 5 = Opponent has disconnected; game ended
 //////////////////////////////////////////////////////////////////////////////

 // suspend():  Disconnect and suspend
function suspend() {
  p1connectionRef.off()
  connectedRef.off()
 // Remove p1/p2 subnode
  p1p2subnodeRef.remove()
  p2key = ''
 // Make yourself available to play other users
  var p1availableRef = database.ref(`connections/${p1key}/available`)
  p1availableRef.set(true)
  return}

 //////////////////////////////////////////////////////////////////////////////
 // Initialize Firebase and Materialize CSS, and start
 //////////////////////////////////////////////////////////////////////////////

 // attachButtonListeners():  Run only once per document
function attachButtonListeners() {
 // Attach state 2 rock-paper-scissors button listeners
  $('#rock').click(function() {
    if (state === 2) {
      p1throw = 0                        // 0 = rock
      $('#p1throw').text('ROCK')
      updateThrow(p1throw)} // if (state === 2)
    return}) // $('#rock').click()
  $('#paper').click(function() {
    if (state === 2) {
      p1throw = 1                        // 1 = paper
      $('#p1throw').text('PAPER')
      updateThrow(p1throw)} // if (state === 2)
    return})
  $('#scissors').click(function() {
    if (state === 2) {
      p1throw = 2                        // 2 = scissors
      $('#p1throw').text('SCISSORS')
      updateThrow(p1throw)} // if (state === 2)
    return})
 // Attach chat message input text field listener
  $('#message').on('focus', function() {
    this.value = ''
    return})
 // Attach chat message SEND button listener
  $('#send').click(function() {
    if (state >= 2 && state < 5) {
      var timestamp = Date.now()
      var message = $('#message').val().trim()
      if (message.length > 0) {
        p1chats.push({timestamp, message})
        var p1p2messageRef = database.ref(`connections/${p1key}/${p2key}` +
          `/messages/${timestamp}`)
        p1p2messageRef.set(message)
        updateChats()}
      }
    return})
  return}

 // rot31():  Rot31 to obscure API key from automated API key harvesting bots
function rot31(s) {
  var n, t = ''
  for (let i = 0; i !== s.length; ++i) {
    n = s.codePointAt(i)
    if (n < 65) n -= 48                  // '0'--'9' -> 0--9
      else if (n < 97) n -= 55           // 'A'--'Z' -> 10--35
        else n -= 61                     // 'a'--'z' -> 36--61
    n = (n + 31) % 62                    // Rot31
    if (n < 10) n += 48                  // 0--9 -> '0'--'9'
      else if (n < 36) n += 55           // 10--35 -> 'A'--'Z'
        else n += 61                     // 36--61 -> 'a'--'z'
    t += String.fromCodePoint(n)}
  return t}

$(document).ready(function() {
  firebaseConfig.apiKey = rot31(firebaseConfig.apikey)
  firebase.initializeApp(firebaseConfig)
  M.AutoInit()
  attachButtonListeners()
  $('#resetModal').modal({
 // Whenever the reset modal starts, disconnect from Firebase if connected
    onOpenStart: function() {
      state = 0
      if (p1key !== '') {
        firebase.app().delete().then(function() {
          firebase.initializeApp(firebaseConfig)
          return})
        key = ''}
      return},
 // When the reset modal is opened, trigger focus on the name input field
    onOpenEnd: function() {
      $('#name').trigger('focus')
      return}
    })
  $('#newGameModal').modal({
 // Whenever the new game modal starts, get list of available users to play
    onOpenStart: getUsers})
 // Start by opening reset modal
  $('#resetModal').modal('open')
  return})
