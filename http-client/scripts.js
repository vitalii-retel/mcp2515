(function() {

    var maxDataItems = 3;

    function Item(type, id, data) {
        this.el = this.createItemElement(type, id);
        this.addData(data);
        return {
            addData: this.addData.bind(this),
            remove: this.remove.bind(this)
        };
    }
    Item.prototype.createElement = function (tplEl) {
        var el = tplEl.cloneNode(true);
        el.removeAttribute('data-template');
        tplEl.parentElement.appendChild(el);
        return el;
    };
    Item.prototype.createItemElement = function (type, id) {
        var el = this.createElement(document.querySelector('.table > .item[data-template]'));
        el.querySelector('.id').textContent = id;
        return el;
    };
    Item.prototype.addData = function (data) {
        var el = this.createElement(this.el.querySelector('.data-table > .data-item[data-template]'));
        var numbers = '';
        var characters = '';
        for (var i = 0; i < data.length; i++) {
            numbers += (numbers.length ? ' ' : '') + ('0' + data[i].toString(16)).substr(-2).toUpperCase();
            characters += (characters.length ? ' ' : '') + String.fromCharCode(data[i]);
        }
        el.querySelector('.numbers').textContent = numbers;
        el.querySelector('.characters').textContent = characters;
        this.removeOldData();
    };
    Item.prototype.removeOldData = function () {
        var nodes = this.el.querySelectorAll('.data-table > .data-item:not([data-template])');
        for (var i = 0; i < nodes.length - maxDataItems; i++) {
            nodes[i].parentElement.removeChild(nodes[i]);
        }
    };
    Item.prototype.remove = function () {
        this.el.parentElement.removeChild(this.el);
    };

    function Table() {
        this.items = {};
        return {
            addData: this.addData.bind(this),
            clear: this.clear.bind(this)
        };
    }
    Table.prototype.addData = function (dataObj) {
        var type = dataObj.type;
        var id = String(dataObj.id);
        var data = dataObj.data;
        if (id in this.items) {
            this.items[id].addData(data);
        } else {
            this.items[id] = new Item(type, id, data);
        }
    };
    Table.prototype.clear = function() {
        for (var id in this.items) {
            this.items[id].remove();
        }
        this.items = {};
    };

    function Session() {
        this.table = new Table();
        this.running = false;
        this.timer = null;
        return {
            init: this.init.bind(this)
        };
    }
    Session.prototype.timerOn = function () {
        this.timer = window.setTimeout(this.tick.bind(this), 333);
    };
    Session.prototype.timerOff = function () {
        window.clearTimeout(this.timer);
    };
    Session.prototype.tick = function () {
        request({
            type: 'GET',
            url: 'getdata'
        }, response => {
            if (response.error) {
                console.error(response.error);
            } else {
                for (var i = 0; i < response.data.length; i++) {
                    this.table.addData(response.data[i]);
                }
            }
            if (this.running) {
                this.timerOn();
            }
        });
    };
    Session.prototype.start = function (speed, cb) {
        this.table.clear();
        request({
            type: 'POST',
            url: 'start',
            body: `speed=${speed}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, response => {
            if (response.error) {
                alert(response.error);
                cb(response.error);
            } else {
                this.running = true;
                this.tick();
                cb();
            }
        });
    };
    Session.prototype.stop = function (cb) {
        this.running = false;
        this.timerOff();
        request({
            type: 'GET',
            url: 'stop'
        }, cb);
    };
    Session.prototype.disableButton = function (button) {
        button.setAttribute('disabled', 'disabled');
    };
    Session.prototype.enableButton = function (button) {
        button.removeAttribute('disabled');
    };
    Session.prototype.init = function () {
        var speedEl = document.querySelector('.buttons .speed');
        var startEl = document.querySelector('.buttons .start');
        var stopEl = document.querySelector('.buttons .stop');

        this.disableButton(stopEl);

        startEl.addEventListener('click', () => {
            this.disableButton(startEl);
            this.disableButton(speedEl);
            this.start(speedEl.value, error => {
                if (error) {
                    this.enableButton(speedEl);
                    this.enableButton(startEl);
                } else {
                    this.enableButton(stopEl);
                }
            });
        });

        stopEl.addEventListener('click', () => {
            this.disableButton(stopEl);
            this.stop(() => {
                this.enableButton(startEl);
                this.enableButton(speedEl);
            });
        });
    };

    function RequestFlag() {
        this.count = 0;
        this.el = document.querySelector('.buttons .request-flag');
        return {
            add: this.add.bind(this),
            remove: this.remove.bind(this),
        };
    };
    RequestFlag.prototype.update = function () {
        if (this.count > 0) {
            this.el.classList.add('on');
        } else {
            this.el.classList.remove('on');
        }
    };
    RequestFlag.prototype.add = function () {
        this.count++;
        this.update();
    };
    RequestFlag.prototype.remove = function () {
        this.count--;
        this.update();
    };

    function _request(requestFlag, params, cb) {
        requestFlag.add();
        var httpRequest = new XMLHttpRequest();
        httpRequest.onreadystatechange = function(){
            if (httpRequest.readyState === XMLHttpRequest.DONE) {
                requestFlag.remove();
                try {
                    cb(JSON.parse(httpRequest.responseText));
                } catch (e) {
                    console.error(e);
                    cb({error: e.message});
                }
            }
        };
        httpRequest.open(params.type, params.url, true);
        if (params.headers) {
            for (var key in params.headers) {
                if (!params.headers.hasOwnProperty(key)) {
                    continue;
                }
                httpRequest.setRequestHeader(key, params.headers[key]);
            }
        }
        httpRequest.send(params.body || null);
    }
    var request = _request.bind(this, new RequestFlag());

    var session = new Session();
    session.init();
})();