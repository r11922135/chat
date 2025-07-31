const corsOptions = {
  origin: [
    "http://localhost:5173", 
    "http://localhost:5174", 
    "http://localhost:3000",
    "https://*.amazonaws.com",  // 允許 AWS 網域
    "https://*.cloudfront.net"  // 允許 CloudFront
  ], 
  methods: ["GET", "POST"]
};

module.exports = corsOptions;
