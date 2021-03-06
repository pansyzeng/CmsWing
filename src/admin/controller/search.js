'use strict';

import Base from './base.js';
import fs  from 'fs';
import path from 'path';
export default class extends Base {
    init(http) {
        super.init(http);
        this.tactive = "setup";

    }
  /**
   * index action
   * @return {Promise} []
   */
  indexAction(){
    //auto render template file index_index.html
      this.meta_title = "全站搜索";
    return this.display();
  }

   async createindexAction(){
       let paths = think.RESOURCE_PATH + "/backup/";
       let lock = paths + "createindex.lock";
       if(this.isAjax("post")&&!think.isEmpty(this.post())){

          think.mkdir(paths);
          //检查是否有正在执行的任务
          if (think.isFile(lock)) {
              return this.fail(20, '检测到有一个重建任务正在执行，请稍后再试！');
          } else {
              //创建锁文件
              fs.writeFileSync(lock, new Date())
          }
          //查询重建索引的表
           let tables = [{table:"document",data:"title,keyname",mod:2,extend:1,name:"文章",pk:"id",addtime:"create_time"},
               {table:"document",data:"title,keyname",mod:3,extend:1,name:"下载",pk:"id",addtime:"create_time"},
               {table:"document",data:"title,keyname",mod:4,extend:1,name:"商品",pk:"id",addtime:"create_time"}];
           await this.session('createindex_tables', tables);
           //清空缓存表
           await this.model("search").where("1=1").delete();
          let page = {'id': 0,'page':1,'pagesize':this.post("pagesize")};
          return this.json({
              'msg': {progress:0,info:"开始索引更新"},
              'page': page,
              'status': 1
          })
      }else if(this.isAjax("get")&&!think.isEmpty(this.get())){
           let tables = await this.session('createindex_tables');
           let id = this.get("id");
           let start = this.get("start");
           let page = this.get("page");
           let pagesize = this.get("pagesize")
           //console.log(this.get());
           let map ={}
           if(tables[id].extend==1){
               map.model_id=tables[id].mod;
               map.status=1
           }
           let field=(tables[id].data).split(",");
           field.push(tables[id].pk);
           field.push(tables[id].addtime);
           let olist = await this.model(tables[id].table).page(page,pagesize).where(map).field(field).countSelect();
           //console.log(olist);
           if(olist.count){
               let narr = [];
               for (let v of olist.data){
                   let obj ={};
                   obj.m_id=tables[id].mod;
                   obj.d_id=v[tables[id].pk];
                   obj.add_time=v[tables[id].addtime];
                   let arr=[];
                   for(let d of tables[id].data.split(",")){
                       arr.push(v[d])
                   }
                   obj.data = arr.join(" ");
                   narr.push(obj)
               }
               //console.log(narr);
               await this.model("search").addMany(narr)
               if(olist.totalPages> olist.currentPage+1){
                   let page = {'id': id, 'page': olist.currentPage+1,'pagesize':olist.numsPerPage};
                   let rate = Math.floor(100 * ((olist.currentPage+1) / olist.totalPages));
                   return this.json({
                       'msg': {progress:rate,info:`正在更新： <span style='color:#ff0000;font-size:14px;text-decoration:underline;' >${tables[id].name}</span> - 总数：${olist.count} - 当前第 <font color='red'>${olist.currentPage}</font> 页 `},
                       'page': page,
                       'status': 1
                   })
               }else {
                   if (tables[++id]) {
                       let page = {'id': id, 'page': 1,"pagesize":pagesize};
                       return this.json({
                           'msg': `<span style='color:#ff0000;font-size:14px;text-decoration:underline;' >${tables[id-1].name}</span>索引更新完成`,
                           'page': page,
                           'status': 1
                       })
                   } else {
                       if (think.isFile(lock)) {
                           fs.unlinkSync(lock)
                       }
                       await this.session('createindex_tables', null);
                       return this.json({
                           'msg': {progress:100,info:"<span style='color:#ff0000;font-size:14px;text-decoration:underline;' >全站</span>索引更新完成"},
                           'status': 1
                       })
                   }
               }
           }
           if (think.isFile(lock)) {
              fs.unlinkSync(lock)
          }
          return this.json({
              'msg': {progress:100,info:"<span style='color:#ff0000;font-size:14px;text-decoration:underline;' >全站</span>索引更新完成"},
              'status': 1
          })

      }else {
          this.meta_title = "重建索引";
          this.active="admin/search/index"
          return this.display();
      }

    }
}