import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://phaafkuwtgpawuqnenkp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYWFma3V3dGdwYXd1cW5lbmtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzMDc5MSwiZXhwIjoyMDk0MDA2NzkxfQ.Oq9Tc6UgWZTKxStGiXDo45_D-Zrc9OPbj0GVp6JUVWs'
);

const [name, id, csvPath] = process.argv.slice(2);
if (!name || !id || !csvPath) { console.error('Usage: node import-one.mjs <name> <id> <csvPath>'); process.exit(1); }

const cleanKey = (k) => k.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').replace(/\n|\r/g, ' ').trim().toLowerCase();

const HM = {
  'full_name':'full_name','full name':'full_name','name of respondant':'full_name','name of respondent':'full_name','contact name':'full_name',
  'business_name':'business_name','business name':'business_name','name of business':'business_name',
  'phone_number':'phone_number','phone number':'phone_number','phone':'phone_number','contact':'phone_number',
  'email':'email','email address':'email','gender':'gender','sex':'gender','age':'age',
  'business_category':'business_category','business category':'business_category','business type':'business_category','type of business':'business_category','sector':'business_category',
  'how_long_in_business':'how_long_in_business','how long in business':'how_long_in_business','how long have you been in this business':'how_long_in_business','how long have you been in business':'how_long_in_business','years in business':'how_long_in_business',
  'primary_income_source':'primary_source_of_income','primary source of income?':'primary_source_of_income','primary source of income':'primary_source_of_income','is this business your primary source of income?':'primary_source_of_income','is this your main source of income':'primary_source_of_income','primary_source_of_income':'primary_source_of_income',
  'products_source':'products_primarily_from','products primarily from?':'products_primarily_from','products primarily from':'products_primarily_from','where do your products primarily come from?':'products_primarily_from','products_primarily_from':'products_primarily_from',
  'business_operates_as':'business_operates_as','business operates as?':'business_operates_as','business operates as':'business_operates_as','how does your business operate?':'business_operates_as','what is the primary operational model of your business?':'business_operates_as',
  'first_time_attendee':'first_time_at_quonnect','first time at quonnect market day?':'first_time_at_quonnect','first time at quonnect market day':'first_time_at_quonnect','is this your first time at quonnect market day?':'first_time_at_quonnect','ls this your first time participating in quonnect':'first_time_at_quonnect','is this your first time participating in quonnect':'first_time_at_quonnect','first_time_at_quonnect':'first_time_at_quonnect',
  'times_attended':'times_attended','times attended?':'times_attended','times attended':'times_attended','how many times have you attended quonnect?':'times_attended','how often do you showcase your business with us?':'times_attended','approximately how many times have you participated':'times_attended',
  'attended_last_quonnect':'attended_last_quonnect','attended last quonnect?':'attended_last_quonnect','attended last quonnect':'attended_last_quonnect','did you attend the last quonnect market day?':'attended_last_quonnect',
  'regions_attended':'regions_attended','regions attended':'regions_attended','which regions have you attended?':'regions_attended',
  'has_paid_employees':'paid_employees','paid employees?':'paid_employees','paid employees':'paid_employees','do you have paid employees?':'paid_employees','do you have any employees':'paid_employees','paid_employees':'paid_employees',
  'number_of_employees':'number_of_employees','number of employees':'number_of_employees','how many employees do you have?':'number_of_employees','how_many_employees_do_you_have':'number_of_employees','employee count':'number_of_employees',
  'female_employees_share':'female_employees','female employees?':'female_employees','female employees':'female_employees','what proportion of your employees are female?':'female_employees','female_employees':'female_employees',
  'youth_employees_share':'youth_employees','youth(18-35) employees?':'youth_employees','youth employees':'youth_employees','what proportion of your employees are youth (18-35)?':'youth_employees','youth_employees':'youth_employees',
  'hired_new_employees_12mo':'hired_new_employees','hired new employees in past 12 months?':'hired_new_employees','hired new employees in past 12 months':'hired_new_employees','did you hire new employees in the past 12 months?':'hired_new_employees','hired_new_employees':'hired_new_employees',
  'new_employees_12mo':'new_employees_count','how many new employees in the past 12 months?':'new_employees_count','how many new employees did you hire in the past 12 months?':'new_employees_count','new_employees_count':'new_employees_count',
  'hires_casual_helpers':'hires_casual_helpers','do you hire casual helpers just for market days (loading, setup, etc.)?':'hires_casual_helpers','do you hire casual helpers just for market days (loading etc.)?':'hires_casual_helpers','do you hire casual helpers just for market days (loading':'hires_casual_helpers','do you hire casual helpers just for market days?':'hires_casual_helpers','do you hire casual helpers':'hires_casual_helpers','casual helpers':'hires_casual_helpers',
  'casual_helpers_count':'casual_helpers_count','number of casual helpers hired?':'casual_helpers_count','number of casual helpers hired':'casual_helpers_count','how many casual helpers do you hire per market day?':'casual_helpers_count','casual helpers count':'casual_helpers_count',
  'business_growth_vs_before':'business_growth','compared to before quonnect,business growth?':'business_growth','compared to before quonnect, business growth?':'business_growth','thinking back over the last 6 months, how would you describe the growth of your business?':'business_growth','business_growth':'business_growth',
  'quonnect_benefits_summary':'quonnect_benefits','how has quonnect benefited your business? (select all that apply)':'quonnect_benefits','how has quonnect benefited your business?':'quonnect_benefits','in what ways has quonnect market day impacted your business? (select all that apply)':'quonnect_benefits','quonnect_benefits':'quonnect_benefits',
  'has_active_social_media':'active_social_media','does your business have active social media?':'active_social_media','active social media':'active_social_media','active_social_media':'active_social_media',
  'makes_online_sales':'online_sales','do you make online sales?':'online_sales','online sales':'online_sales','online_sales':'online_sales',
  'how_heard_about_quonnect':'how_did_you_know','how did you know about quonnect?':'how_did_you_know','how did you hear about quonnect?':'how_did_you_know','how did you hear about quonnect':'how_did_you_know','how_did_you_know':'how_did_you_know',
  'would_recommend_quonnect':'would_recommend','would you recommend quonnect?':'would_recommend','would you recommend quonnect to others?':'would_recommend','would_recommend':'would_recommend',
  'main_challenges_summary':'main_challenges','what are your main business challenges? (select all that apply)':'main_challenges','main business challenges':'main_challenges','what are the biggest challenges affecting your business growth? (select all that apply)':'main_challenges','main_challenges':'main_challenges',
};

const SKIPPED = new Set(['start','end','_id','_uuid','submission_time','submitted_by','__version__','root_uuid','_index','meta/rootuuid','_status','_notes','_tags','validation_status','_submission_time','_submitted_by','kobo_id','kobo_uuid','row_index','form_version','submission_status']);

const QM = {
  full_name:'410d3888-052d-4b4e-9812-b4af6315c517',business_name:'5ff4d9db-f9de-4eb8-8901-de8fdfcee2c0',
  phone_number:'2bedf690-6343-415f-9e91-51f2f6097fa5',email:'116733b9-8694-4d98-8637-066f5da2226e',
  gender:'287b4920-998f-42e3-8c60-6e5658d88a2f',age:'b54f5b8b-9004-43a3-b967-95a9ef64dd78',
  business_category:'b8aec37f-b458-411c-986c-cc79daa26c6d',how_long_in_business:'59a389d4-9322-4c4c-b9e6-fd1777048dc2',
  primary_source_of_income:'a4bac9df-6ea3-4adf-ab92-f1b3d7d5cf81',products_primarily_from:'86f64dce-1630-48f5-b433-a1d60c620c8f',
  business_operates_as:'d854b5be-1d42-4a0c-9e41-b04d8a107c3d',first_time_at_quonnect:'333f4198-8f90-46d2-bf6a-f64f723f6487',
  times_attended:'77b8b872-92f4-43a8-9e81-a148cecece75',attended_last_quonnect:'4ca12848-7b6d-429f-9a47-e2c19967d572',
  regions_attended:'a201be01-6831-4e25-9994-2ceb65e236fe',paid_employees:'c53c3db9-5599-403c-90ee-f840cf6df6f9',
  number_of_employees:'73f2e270-14fa-4677-9b00-bb7622fe6c0f',female_employees:'4a3596fe-4748-4ebc-af04-29d59f9b5bac',
  youth_employees:'0af0aa97-2420-441e-8f0d-f426c07cf1d8',hired_new_employees:'31f38046-92a1-4ef9-88ee-065977857ade',
  new_employees_count:'ac19db83-a3c5-4f4e-96e3-493a6524e30f',hires_casual_helpers:'93cdfd0a-e35c-44ad-825e-3cfa8e11fc04',
  casual_helpers_count:'71c930be-f7ad-460c-954a-c89f5c5eef27',business_growth:'59742bda-5086-4300-bce1-a2a048cef780',
  quonnect_benefits:'9c95304c-e5ad-4283-b6c9-2e7d892cf6fb',active_social_media:'2ce847de-74e5-498d-bd96-937c6ce8dde4',
  online_sales:'26b0d5eb-869e-4707-8089-ccb9aa63a4bf',how_did_you_know:'25232bd6-08d7-4437-8596-10504e6bccbf',
  would_recommend:'a9be34f3-a910-4326-955f-a0dca0495048',main_challenges:'a0571885-3356-4771-b20a-706aba28eebd',
};

function parseLine(line, d) {
  const r=[]; let c='',q=false;
  for(const ch of line){if(ch==='"')q=!q;else if(ch===d&&!q){r.push(c.trim());c='';}else c+=ch;}
  r.push(c.trim()); return r;
}

async function main() {
  const text = readFileSync(csvPath, 'utf-8');
  const d = text.split('\n')[0].includes(';')?';':',';
  const allLines = text.split(/\r?\n/);
  const headers = parseLine(allLines[0], d);
  const rows = [];
  for (let i=1;i<allLines.length;i++){if(!allLines[i].trim())continue;const v=parseLine(allLines[i],d);const o={};headers.forEach((h,j)=>{o[h]=v[j]||'';});rows.push(o);}

  console.log(`${name}: ${rows.length} rows`);

  let unmapped=new Set(), ok=0, bad=0, skip=0;

  for(let i=0;i<rows.length;i++){
    const raw=rows[i];
    const clean={};
    for(const [k,v] of Object.entries(raw))clean[cleanKey(k)]=String(v??'').trim();
    const norm={};
    for(const [k,v] of Object.entries(clean)){if(HM[k])norm[HM[k]]=v;else if(!SKIPPED.has(k)&&!k.includes('/'))unmapped.add(k);}
    if(!norm.full_name&&!norm.business_name){skip++;continue;}

    try{
      const {data:vr,error:ve}=await supabase.from('vendors').upsert({
        contact_name:norm.full_name||'',business_name:norm.business_name||'',
        phone:norm.phone_number||'',email:norm.email||'',
        category:norm.business_category||'',is_active:true,
      },{onConflict:'phone',ignoreDuplicates:false}).select('id').single();
      if(ve){bad++;if(bad<=3)console.error(`Row${i+1} vendor:`,ve.message);continue;}

      const {data:rr,error:re}=await supabase.from('survey_responses').insert({
        form_id:'bbc85f27-235c-4565-adcd-546a09d4c84e',context_type:'market_day',
        context_id:id,vendor_id:vr.id,source:'csv_import',import_batch:csvPath.split('/').pop(),
      }).select('id').single();
      if(re){bad++;if(bad<=3)console.error(`Row${i+1} response:`,re.message);continue;}

      const ans=[];
      for(const h of Object.keys(raw)){const ck=cleanKey(h),cc=HM[ck];if(!cc)continue;const qi=QM[cc];if(!qi)continue;const val=raw[h];if(!val)continue;ans.push({response_id:rr.id,question_id:qi,answer:String(val).trim()});}
      for(let j=0;j<ans.length;j+=50)await supabase.from('survey_answers').upsert(ans.slice(j,j+50),{onConflict:'response_id,question_id',ignoreDuplicates:true});
      ok++;
      if(ok%50===0)process.stdout.write(`${ok} `);
    }catch(e){bad++;if(bad<=3)console.error(`Row${i+1}:`,e.message);}
  }
  process.stdout.write(`${ok}\n`);
  if(unmapped.size>0)console.warn('Unmapped:',[...unmapped]);
  console.log(`Done: ${ok} ok, ${bad} failed, ${skip} skipped`);
}
main().catch(e=>{console.error(e);process.exit(1);});
