import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  mode: { type:String, enum:['inspiration','live'], default:'inspiration' },
  embedCode: { type:String, default:'' },
},{ timestamps:true });

schema.statics.getSingleton = async function(){
  let d = await this.findOne();
  if(!d) d = await this.create({});
  return d;
};

export default mongoose.models.LiveContent || mongoose.model('LiveContent', schema);
