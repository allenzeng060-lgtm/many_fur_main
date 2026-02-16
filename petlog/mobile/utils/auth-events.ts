type AuthEventListener = () => void;

const listeners: AuthEventListener[] = [];

export const authEvents = {
    subscribe(listener: AuthEventListener) {
        listeners.push(listener);
        return () => {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    },

    emitLogout() {
        listeners.forEach((listener) => listener());
    },
};
