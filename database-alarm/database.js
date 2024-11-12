const mysql = require('mysql2');

// Tạo kết nối với cơ sở dữ liệu
const connection = mysql.createConnection({
  host: 'localhost',       
  user: 'root',           
  password: '123456', 
  database: 'alarma_iot_db' 
});

// Kết nối đến MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database!');
});

// Export kết nối để sử dụng trong các module khác
module.exports = connection;
