const express = require("express");
const bodyParser = require("body-parser");
const connection = require("../database-alarm/database"); // Import kết nối từ database.js

// Khởi tạo server Express
const server = express();
server.use(bodyParser.json()); // Hỗ trợ parse JSON từ các request

// Cấu hình CORS để cho phép truy cập từ các nguồn khác nhau
server.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// POST /alarma/set - Thiết lập báo thức
server.post("/alarma/set", (req, res) => {
  const { hour, minutes } = req.body; // Nhận giờ và phút từ request

  // Kiểm tra dữ liệu đầu vào hợp lệ
  if (typeof hour === "undefined" || typeof minutes === "undefined") {
    return res.status(400).json({ error: "Thiếu thông tin giờ hoặc phút." });
  }

  // Kiểm tra xem giá trị có phải số nguyên và nằm trong phạm vi hợp lệ
  if (
    isNaN(hour) ||
    isNaN(minutes) ||
    hour < 0 ||
    hour > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return res.status(400).json({ error: "Giá trị giờ hoặc phút không hợp lệ." });
  }

  // Định dạng giờ phút với padding số 0 nếu cần thiết
  const formattedHour = String(hour).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  // Tạo thời gian dạng DATETIME với ngày hiện tại
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0]; // Định dạng ngày hiện tại thành YYYY-MM-DD
  const alarmTime = `${formattedDate} ${formattedHour}:${formattedMinutes}:00`; // Tạo giá trị DATETIME: YYYY-MM-DD HH:MM:SS

  // Chèn thông tin báo thức vào cơ sở dữ liệu
  const query = `
    INSERT INTO alarmclock (alarmTime, createDate, updateDate)
    VALUES (?, NOW(), NOW())
  `;
  connection.query(query, [alarmTime], (err, results) => {
    if (err) {
      console.error("Lỗi cơ sở dữ liệu:", err);
      return res.status(500).json({ error: "Không thể thiết lập báo thức." });
    }
    res.status(201).json({
      message: "Báo thức đã được thiết lập thành công!",
      id: results.insertId, // Trả về `id` mới tạo
      scheduled: `Báo thức được thiết lập vào lúc ${formattedHour}:${formattedMinutes}`
    });
  });
});


// GET /alarma/status - Kiểm tra trạng thái báo thức
server.get("/alarma/status", (req, res) => {
  const today = new Date();
  const currentHour = today.getHours();
  const currentMinute = today.getMinutes();

  // Lấy thông tin báo thức gần nhất từ cơ sở dữ liệu
  const query = "SELECT * FROM alarmclock ORDER BY alarmTime ASC LIMIT 1";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Lỗi cơ sở dữ liệu:", err);
      return res.status(500).json({ error: "Không thể kiểm tra trạng thái báo thức." });
    }

    if (results.length > 0) {
      let { alarmTime } = results[0];

      // Kiểm tra nếu `alarmTime` không phải là chuỗi và chuyển đổi nếu cần
      if (alarmTime instanceof Date) {
        // Định dạng `alarmTime` từ Date sang chuỗi 'HH:MM'
        alarmTime = alarmTime.toTimeString().split(" ")[0]; // Lấy 'HH:MM:SS'
        alarmTime = alarmTime.substring(0, 5); // Chỉ lấy 'HH:MM'
      } else if (typeof alarmTime !== "string") {
        // Nếu `alarmTime` không phải chuỗi hoặc ngày, trả về lỗi
        console.error("Giá trị alarmTime không hợp lệ:", alarmTime);
        return res.status(500).json({ error: "Dữ liệu báo thức không hợp lệ." });
      }

      const [alarmHour, alarmMinute] = alarmTime.split(":").map(Number);

      // Kiểm tra xem thời gian hiện tại có khớp với thời gian báo thức hay không
      if (
        currentHour > alarmHour ||
        (currentHour === alarmHour && currentMinute >= alarmMinute)
      ) {
        console.log("Báo thức được kích hoạt!");
        res.status(200).json({ state: "active", message: "Báo thức đang kêu." });
      } else {
        res.status(200).json({ state: "inactive", message: "Báo thức chưa đến giờ." });
      }
    } else {
      res.status(200).json({ state: "none", message: "Không có báo thức nào." });
    }
  });
});


// GET /alarma/cancel - Hủy bỏ tất cả báo thức
server.get("/alarma/cancel", (req, res) => {
  // Xóa tất cả các báo thức trong cơ sở dữ liệu
  const query = "DELETE FROM alarmclock";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Lỗi cơ sở dữ liệu:", err);
      return res.status(500).json({ error: "Không thể hủy báo thức." });
    }

    console.log("Tất cả báo thức đã được hủy.");
    res.status(200).json({ message: "Tất cả báo thức đã được hủy thành công." });
  });
});



// PUT /alarma/update - Chỉnh sửa báo thức đã tạo
server.put("/alarma/update", (req, res) => {
  const { id, hour, minutes } = req.body; // Nhận thông tin từ request body

  // Kiểm tra dữ liệu đầu vào hợp lệ
  if (typeof id === "undefined" || typeof hour === "undefined" || typeof minutes === "undefined") {
    return res.status(400).json({ error: "Thiếu thông tin id, giờ hoặc phút." });
  }

  // Kiểm tra xem giá trị có phải số nguyên và nằm trong phạm vi hợp lệ
  if (
    isNaN(id) ||
    isNaN(hour) ||
    isNaN(minutes) ||
    id <= 0 ||
    hour < 0 ||
    hour > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return res.status(400).json({ error: "Giá trị id, giờ hoặc phút không hợp lệ." });
  }

  // Định dạng giờ phút với padding số 0 nếu cần thiết
  const formattedHour = String(hour).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  // Tạo thời gian dạng DATETIME với ngày hiện tại
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0]; // Định dạng ngày hiện tại thành YYYY-MM-DD
  const alarmTime = `${formattedDate} ${formattedHour}:${formattedMinutes}:00`; // Tạo giá trị DATETIME: YYYY-MM-DD HH:MM:SS

  // Cập nhật thông tin báo thức trong cơ sở dữ liệu theo id
  const query = `
    UPDATE alarmclock
    SET alarmTime = ?, updateDate = NOW()
    WHERE id = ?
  `;
  connection.query(query, [alarmTime, id], (err, results) => {
    if (err) {
      console.error("Lỗi cơ sở dữ liệu:", err);
      return res.status(500).json({ error: "Không thể cập nhật báo thức." });
    }

    if (results.affectedRows === 0) {
      // Không có báo thức nào được cập nhật (id không tồn tại)
      return res.status(404).json({ error: "Không tìm thấy báo thức với id được cung cấp." });
    }

    res.status(200).json({
      message: "Báo thức đã được cập nhật thành công!",
      updatedTime: `Báo thức được cập nhật vào lúc ${formattedHour}:${formattedMinutes}`
    });
  });
});



// Lắng nghe kết nối trên cổng 8080
server.listen(8080, () => {
  console.log("Server đang chạy trên cổng 8080");
});



//connect to mqtt
const mqtt = require('mqtt');

// Kết nối HiveMQ Broker
const mqttClient = mqtt.connect('mqtts://0d67c96de11a46f0b892938e1f398e60.s1.eu.hivemq.cloud', {
  port: 8883,
  username: 'vietabc',
  password: 'Vietabc123'
});

mqttClient.on('connect', () => {
  console.log('Đã kết nối HiveMQ!');
  mqttClient.subscribe('esp32/ds1307', (err) => {
    if (!err) console.log('Đã đăng ký topic esp32/ds1307');
  });
});

// Nhận dữ liệu từ ESP32
mqttClient.on('message', (topic, message) => {
  if (topic === 'esp32/ds1307') {
    console.log(`Dữ liệu nhận từ ESP32: ${message.toString()}`);
  }
});

// API gửi lệnh tới ESP32
server.post('/alarma/command', (req, res) => {
  const { command } = req.body;
  if (!['on', 'off'].includes(command)) {
    return res.status(400).json({ error: 'Chỉ chấp nhận lệnh "on" hoặc "off"' });
  }
  mqttClient.publish('alarma/command', command, (err) => {
    if (err) return res.status(500).json({ error: 'Gửi lệnh thất bại.' });
    res.status(200).json({ message: `Lệnh "${command}" đã được gửi!` });
  });
});
