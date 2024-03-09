import importlib

def loadClass(module_name,class_name):
    module = importlib.import_module(module_name)
    class_ = getattr(module, class_name)
    instance = class_()
    return instance