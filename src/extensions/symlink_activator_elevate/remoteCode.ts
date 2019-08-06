export function remoteCode(ipcClient, req) {
  const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'EIO', 'EBADF', 'UNKNOWN']);

  const delayed = (delay: number) => new Promise(resolve => {
    setTimeout(resolve, delay);
  });

  const doFS = (op: () => Promise<any>, tries: number = 5) => {
    return op().catch(err => {
      if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
        return delayed(100).then(() => doFS(op, tries - 1));
      } else {
        return Promise.reject(err);
      }
    });
  };

  return new Promise<void>((resolve, reject) => {
    const TAG_NAME = process.platform === 'win32'
      ? '__folder_managed_by_vortex'
      : '.__folder_managed_by_vortex';

    const fs = req('fs-extra');
    const path = req('path');

    const emit = (message, payload) => {
      ipcClient.sendMessage({ message, payload });
    };

    const handlers = {
      'link-file': (payload) => {
        const { source, destination, num } = payload;
        fs.ensureDir(path.dirname(destination))
          .then(created => {
            if (created !== null) {
              emit('log', {
                level: 'debug',
                message: 'created directory',
                meta: { dirName: path.dirname(destination) },
              });
              return doFS(() => fs.writeFile(
                path.join(created, TAG_NAME),
                  'This directory was created by Vortex deployment and will be removed ' +
                  'during purging if it\'s empty'));
            } else {
              // if the directory did exist there is a chance the destination file already
              // exists
              return doFS(() => fs.remove(destination))
                .catch(err => (err.code === 'ENOENT')
                  ? Promise.resolve()
                  : Promise.reject(err));
            }
          })
          .then(() => doFS(() => fs.symlink(source, destination))
            .catch(err => (err.code !== 'EEXIST')
              ? Promise.reject(err)
              : doFS(() => fs.remove(destination))
                .then(() => doFS(() => fs.symlink(source, destination)))))
          .then(() => {
            emit('log', {
              level: 'debug',
              message: 'installed',
              meta: { source, destination },
            });
            emit('completed', { err: null, num });
          })
          .catch((err) => {
            if (err.code === 'EISDIR') {
              emit('report', 'not-supported');
            } else {
              emit('log', {
                level: 'error',
                message: 'failed to install symlink',
                meta: { err: err.message },
              });
            }
            emit('completed', { err, num });
          });
      },
      'remove-link': (payload) => {
        const { destination, num } = payload;
        doFS(() => fs.lstat(destination))
          .then(stats => {
            if (stats.isSymbolicLink()) {
              return doFS(() => fs.remove(destination));
            }
          })
          .then(() => {
            emit('completed', { err: null, num });
          })
          .catch((err) => {
            emit('completed', {
              err: { code: err.code, message: err.message, stack: err.stack },
              num });
          });
      },
      quit: () => {
        // currently don't need this message, the server closes the connection and
        // we clean up when the ipc is disconnected
      },
    };

    ipcClient.on('message', data => {
      const { message, payload } = data;
      if (handlers[message] !== undefined) {
        handlers[message](payload);
      } else {
        emit('log', {
          level: 'error',
          message:
            `unknown message "${message}", expected one of "${Object.keys(handlers).join(', ')}"`,
          meta: { got: message },
        });
      }
    });

    ipcClient.on('disconnect', () => { resolve(); });
    emit('initialised', {});
  });
}
