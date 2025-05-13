import tensorflow as tf
print(tf.__version__)
print(hasattr(tf, "compat") and hasattr(tf.compat, "v2"))