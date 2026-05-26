CC = clang
CFLAGS = -Wall -pedantic -std=c99
PYTHON = -I/usr/include/python3.14

all: _phylib.so 

clean:
	rm -rf *.o *.so *.svg __pycache__  *.db myprog phylib_wrap.c phylib.py .nfs*

libphylib.so: phylib.o
	$(CC) -shared -o libphylib.so phylib.o -lm

phylib.o: phylib.c phylib.h
	$(CC) $(CFLAGS) -fPIC -c phylib.c -o phylib.o

phylib_wrap.c: phylib.i
	swig -python phylib.i

phylib_wrap.o: phylib_wrap.c
	$(CC) $(CFLAGS) -c phylib_wrap.c $(PYTHON) -fPIC -o phylib_wrap.o

_phylib.so: phylib_wrap.o libphylib.so
	$(CC) $(CFLAGS) -shared phylib_wrap.o -L. -lphylib -Wl,-rpath,. -L/usr/lib/python3.14 -lpython3.14 -o _phylib.so

# export LD_LIBRARY_PATH=`pwd`
# python3 server.py 58467