from flask import Flask
from routes.predict_routes import predict_bp

app = Flask(__name__)

# Register the blueprint containing your routes
app.register_blueprint(predict_bp)

if __name__ == "__main__":
    app.run(debug=True)
