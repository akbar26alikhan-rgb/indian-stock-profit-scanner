import xgboost as xgb
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

# Load data
# Here you should replace 'data.csv' with your actual data file
# It should contain both fundamental and technical features

data = pd.read_csv('data.csv')

# Prepare features and target
# Assuming 'target' is the name of the target column you want to predict
X = data.drop(columns=['target'])
y = data['target']

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Create the DMatrix
train_dmatrix = xgb.DMatrix(data=X_train, label=y_train)
test_dmatrix = xgb.DMatrix(data=X_test, label=y_test)

# Set parameters for XGBoost model
def get_xgb_params():
    return {
        'objective': 'reg:squarederror',
        'colsample_bytree': 0.3,
        'learning_rate': 0.1,
        'max_depth': 5,
        'alpha': 10,
        'n_estimators': 10
    }

xgb_params = get_xgb_params()

# Train the model
xgb_model = xgb.train(params=xgb_params, dtrain=train_dmatrix, num_boost_round=10)

# Make predictions
predictions = xgb_model.predict(test_dmatrix)

# Evaluate the model
mse = mean_squared_error(y_test, predictions)
print(f'Mean Squared Error: {mse}')
