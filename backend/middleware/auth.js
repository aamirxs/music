const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
    try {
        // Get token from different possible sources
        let token = req.header('Authorization') || req.query.token || req.cookies?.token;

        // Remove Bearer prefix if present
        if (token && token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ 
                success: false,
                message: 'No authentication token, access denied'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            req.userId = decoded.userId;
            next();
        } catch (e) {
            console.error('Token verification failed:', e.message);
            return res.status(401).json({ 
                success: false,
                message: 'Token is not valid'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(500).json({ 
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = auth;
