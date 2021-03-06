import React, {Component} from 'react';
import {Layout, message} from 'antd';
import Aria2Client from './aria2client'
import './device'

import LeftSider from './components/LeftSider'
import DownloadView from './components/DownloadView'
import SettingView from './components/SettingView'

import './App.css';
import {eventBus, getStorage, setStorage} from "./utils";
import {getDownloadSaveDir, isRemoteServer, setDownloadSaveDir} from "./aria2utils";

const defaultServer = {
  id: 1,
  title: '本地默认',
  host: '127.0.0.1',
  port: 6800,
  secure: false,
  secret: window.location.hash.split('#')[1]
};
setStorage('ARIA2_LOCAL_SERVER', defaultServer);
let conf = getStorage('ARIA2_SERVER');
if (conf) {
  if (conf.id === 1) {
    conf = defaultServer;
    setStorage('ARIA2_SERVER', defaultServer)
  }
} else {
  conf = defaultServer
}

class App extends Component {

  state = {
    actives: [],
    waitings: [],
    stopped: [],
    menu: 'active',
    online: false,
    isRemoteServer: isRemoteServer()
  };

  constructor(props){
    super(props);
    this.aria2 = new Aria2Client({
      ...conf,
      onRefresh: (data) => {
        this.setState({
          ...data
        })
      }
    });

    this.aria2.onConnect = async () => {
      this.aria2.getGlobalOption().then(config => {
        if (!getDownloadSaveDir()){
          setDownloadSaveDir(config.dir);
        }
        eventBus.emit('aria2_connect', config);
        this.setState({online: true});
      }).catch(e => {
        message.error(`连接服务器失败: ${e.message}`);
        this.setState({online: false})
      })
    };
    this.aria2.onClose = () => {
      this.setState({online: false})
    }
  }

  componentWillMount(){
    this.aria2.connect().catch(() => {
      const cfg = this.aria2.config
      message.error(`无法连接到${cfg.host}:${cfg.port}`)
    })
  }

  onMenuClick(item){
    this.setState({
      menu: item
    })
  }

  async connectToServer(server){
    const hide = message.loading(`正在连接到${server.host}:${server.port}...`, 0);
    this.setState({
      actives: [],
      waitings: [],
      stopped: [],
      isRemoteServer: isRemoteServer()
    });
    try {
      await this.aria2.close();
      this.aria2.setOptions(server);
      await this.aria2.connect()
      hide();
    } catch (e) {
      hide();
      if (e && e.type === 'error') {
        message.error(`无法连接到${server.host}:${server.port}`)
      }
    }
  }

  render() {
    let data;
    if (this.state.menu === 'active') {
      data = [...this.state.actives, ...this.state.waitings];
    } else if (this.state.menu === 'complete') {
      data = this.state.stopped.filter(item => item.status === 'complete')
    } else if (this.state.menu === 'remove'){
      data = this.state.stopped.filter(item => item.status !== 'complete')
    }
    return (
      <Layout className={`App ${this.state.isRemoteServer ? 'server-is-remote' : ''}`}>
        <LeftSider defaultMenu={this.state.menu}
                   defaultServerConf={conf}
                   online={this.state.online}
                   onChangeServer={async c => await this.connectToServer(c)}
                   onMenuClick={(item) => this.onMenuClick(item)}/>
        {this.state.menu && this.state.menu !== 'setting' ?
          <DownloadView aria2={this.aria2} currentMenu={this.state.menu} data={data}/>:
          <SettingView aria2={this.aria2} />}
      </Layout>
    );
  }
}

export default App;
