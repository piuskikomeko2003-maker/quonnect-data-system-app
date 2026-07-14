const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local not found at " + envPath);
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in .env.local");
  process.exit(1);
}

console.log("Connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

const INITIAL_VENDORS = [
  {
    name: 'Grace Achieng',
    phone: '0772123456',
    businessName: 'Achieng Fashion & Tailoring',
    gender: 'Female',
    status: 'loyal',
    region: 'Kampala',
    attendanceCount: 7,
    lastSeen: 'May 2026',
    age: 28,
    employeeCount: '4',
    newHiresThisYear: '2',
    businessType: 'Fashion',
    sellsOwnProducts: 'Yes',
    exportReady: 'Yes',
    impactRating: 5,
    businessGrowthNarrative: 'Expanding my shop and training two new local interns.',
    dob: '1998-04-12',
    amountPaid: '50000',
    email: 'grace@achiengfashion.com'
  },
  {
    name: 'Sarah Namubiru',
    phone: '0781987654',
    businessName: 'Kampala Organic Cosmetics',
    gender: 'Female',
    status: 'active',
    region: 'Kampala',
    attendanceCount: 3,
    lastSeen: 'May 2026',
    age: 24,
    employeeCount: '2',
    newHiresThisYear: '1',
    businessType: 'Beauty',
    sellsOwnProducts: 'Yes',
    exportReady: 'No',
    impactRating: 4,
    businessGrowthNarrative: 'Sourcing ingredients from northern Uganda farmers.',
    dob: '2002-08-23',
    amountPaid: '50000',
    email: 'sarah@organiccosmetics.ug'
  },
  {
    name: 'Brian Mugisha',
    phone: '0702333444',
    businessName: 'Mugisha Craft Workshop',
    gender: 'Male',
    status: 'active',
    region: 'Jinja',
    attendanceCount: 2,
    lastSeen: 'April 2026',
    age: 35,
    employeeCount: '3',
    newHiresThisYear: '0',
    businessType: 'Crafts',
    sellsOwnProducts: 'Yes',
    exportReady: 'Yes',
    impactRating: 4,
    businessGrowthNarrative: 'Wood carving and exporting souvenirs to neighboring countries.',
    dob: '1991-11-05',
    amountPaid: '40000',
    email: 'brian@mugishacrafts.com'
  },
  {
    name: 'Proscovia Nalwanga',
    phone: '0754555666',
    businessName: 'Nalwanga Snacks & Catering',
    gender: 'Female',
    status: 'loyal',
    region: 'Kampala',
    attendanceCount: 6,
    lastSeen: 'May 2026',
    age: 31,
    employeeCount: '5',
    newHiresThisYear: '1',
    businessType: 'Food',
    sellsOwnProducts: 'Yes',
    exportReady: 'No',
    impactRating: 5,
    businessGrowthNarrative: 'Bought a second frying machine and hired my sister.',
    dob: '1995-02-14',
    amountPaid: '50000',
    email: 'prossy@snacks.ug'
  },
  {
    name: 'Derrick Okello',
    phone: '0776777888',
    businessName: 'Okello Smart Electronics',
    gender: 'Male',
    status: 'new',
    region: 'Kampala',
    attendanceCount: 1,
    lastSeen: 'May 2026',
    age: 22,
    employeeCount: '1',
    newHiresThisYear: '0',
    businessType: 'Electronics',
    sellsOwnProducts: 'No',
    exportReady: 'No',
    impactRating: 3,
    businessGrowthNarrative: 'Just starting out, selling imported phone accessories.',
    dob: '2004-05-30',
    amountPaid: '50000',
    email: 'okelloderrick@gmail.com'
  },
  {
    name: 'Fiona Atim',
    phone: '0788111222',
    businessName: 'Atim Honey Processing',
    gender: 'Female',
    status: 'loyal',
    region: 'Mbarara',
    attendanceCount: 8,
    lastSeen: 'May 2026',
    age: 29,
    employeeCount: '6',
    newHiresThisYear: '3',
    businessType: 'Agriculture',
    sellsOwnProducts: 'Yes',
    exportReady: 'Yes',
    impactRating: 5,
    businessGrowthNarrative: 'Secured national certification for retail shelves.',
    dob: '1997-09-19',
    amountPaid: '45000',
    email: 'atim@honeyug.com'
  },
  {
    name: 'Brenda Kabasomi',
    phone: '0701444555',
    businessName: 'Kabasomi Knitwear & Crochet',
    gender: 'Female',
    status: 'dormant',
    region: 'Kampala',
    attendanceCount: 5,
    lastSeen: 'March 2026',
    age: 27,
    employeeCount: '2',
    newHiresThisYear: '0',
    businessType: 'Fashion',
    sellsOwnProducts: 'Yes',
    exportReady: 'No',
    impactRating: 4,
    businessGrowthNarrative: 'Experiencing seasonal drops in yarn supply.',
    dob: '1999-01-25',
    amountPaid: '50000',
    email: 'brenda@knitwear.ug'
  }
];

async function seed() {
  try {
    // 1. Insert Regions
    console.log("Inserting regions...");
    const regionsToInsert = [
      { name: 'Kampala', slug: 'kampala' },
      { name: 'Jinja', slug: 'jinja' },
      { name: 'Mbarara', slug: 'mbarara' }
    ];
    
    // Check if regions exist, or insert them
    const { data: dbRegions, error: regError } = await supabase.from('regions').select('*');
    if (regError) throw regError;

    let regionMap = {};
    for (const reg of dbRegions || []) {
      regionMap[reg.name] = reg.id;
    }

    for (const reg of regionsToInsert) {
      if (!regionMap[reg.name]) {
        const { data: insertedReg, error: insError } = await supabase.from('regions').insert(reg).select();
        if (insError) throw insError;
        if (insertedReg && insertedReg[0]) {
          regionMap[reg.name] = insertedReg[0].id;
        }
      }
    }
    console.log("Region IDs map:", regionMap);

    // 2. Insert Events
    console.log("Inserting events...");
    const eventsToInsert = [
      { name: 'Kampala May 2026', date: '2026-05-26', status: 'completed', region_name: 'Kampala', slug: 'kampala-may-2026' },
      { name: 'Kampala April 2026', date: '2026-04-26', status: 'completed', region_name: 'Kampala', slug: 'kampala-april-2026' },
      { name: 'Kampala March 2026', date: '2026-03-26', status: 'completed', region_name: 'Kampala', slug: 'kampala-march-2026' },
      { name: 'Jinja April 2026', date: '2026-04-26', status: 'completed', region_name: 'Jinja', slug: 'jinja-april-2026' },
      { name: 'Mbarara May 2026', date: '2026-05-26', status: 'completed', region_name: 'Mbarara', slug: 'mbarara-may-2026' }
    ];

    const { data: dbEvents, error: edError } = await supabase.from('events').select('*');
    if (edError) throw edError;

    let eventMap = {};
    for (const ev of dbEvents || []) {
      eventMap[ev.name] = ev.id;
    }

    for (const ev of eventsToInsert) {
      if (!eventMap[ev.name]) {
        const regId = regionMap[ev.region_name];
        const { data: insertedEv, error: insEvError } = await supabase
          .from('events')
          .insert({
            region_id: regId,
            date: ev.date,
            name: ev.name,
            status: ev.status,
            slug: ev.slug
          })
          .select();
        if (insEvError) throw insEvError;
        if (insertedEv && insertedEv[0]) {
          eventMap[ev.name] = insertedEv[0].id;
        }
      }
    }
    console.log("Event IDs map:", eventMap);

    // 3. Insert Vendors
    console.log("Inserting vendors...");
    for (const v of INITIAL_VENDORS) {
      // Find if vendor exists by phone
      const { data: existingVendor, error: checkError } = await supabase
        .from('vendors')
        .select('*')
        .eq('phone', v.phone);
      
      if (checkError) throw checkError;

      let vendorId;
      const homeRegionId = regionMap[v.region];

      if (existingVendor && existingVendor.length > 0) {
        vendorId = existingVendor[0].id;
        console.log(`Vendor ${v.name} already exists with ID: ${vendorId}`);
      } else {
        const { data: insertedVendor, error: insVError } = await supabase
          .from('vendors')
          .insert({
            phone: v.phone,
            email: v.email,
            business_name: v.businessName,
            name: v.name,
            gender: v.gender,
            age: v.age
          })
          .select();
        
        if (insVError) throw insVError;
        if (insertedVendor && insertedVendor[0]) {
          vendorId = insertedVendor[0].id;
          console.log(`Created vendor ${v.name} with ID: ${vendorId}`);
        }
      }

      if (vendorId) {
        // Insert vendor_regions
        const { data: existingVR, error: vrCheckError } = await supabase
          .from('vendor_regions')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('region_id', homeRegionId);
        
        if (vrCheckError) throw vrCheckError;
        if (!existingVR || existingVR.length === 0) {
          const { error: vrInsError } = await supabase
            .from('vendor_regions')
            .insert({
              vendor_id: vendorId,
              region_id: homeRegionId,
              status: v.status
            });
          if (vrInsError) throw vrInsError;
        }

        // Insert Attributes
        console.log(`Inserting attributes for ${v.name}...`);
        const targetEditionLabel = v.lastSeen === 'May 2026' 
          ? (v.region === 'Kampala' ? 'Kampala May 2026' : 'Mbarara May 2026') 
          : (v.lastSeen === 'April 2026' 
              ? (v.region === 'Kampala' ? 'Kampala April 2026' : 'Jinja April 2026')
              : 'Kampala March 2026');
        const evId = eventMap[targetEditionLabel];

        const attributes = [
          { key: 'employee_count', value: v.employeeCount },
          { key: 'new_hires_this_year', value: v.newHiresThisYear },
          { key: 'business_type', value: v.businessType },
          { key: 'sells_own_products', value: v.sellsOwnProducts },
          { key: 'export_ready', value: v.exportReady },
          { key: 'impact_rating', value: String(v.impactRating) },
          { key: 'business_growth_narrative', value: v.businessGrowthNarrative }
        ];

        for (const attr of attributes) {
          // Check if attribute already exists
          const { data: existingAttr, error: attrCheckError } = await supabase
            .from('vendor_attributes')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('key', attr.key);
          
          if (attrCheckError) throw attrCheckError;

          if (!existingAttr || existingAttr.length === 0) {
            const { error: attrInsError } = await supabase
              .from('vendor_attributes')
              .insert({
                vendor_id: vendorId,
                key: attr.key,
                value: attr.value,
                source: 'self_reported',
                event_id: evId
              });
            if (attrInsError) throw attrInsError;
          }
        }

        // Insert event_registrations
        console.log(`Inserting event registrations for ${v.name}...`);
        if (evId) {
          const { data: existingReg, error: regCheckError } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('event_id', evId);
          
          if (regCheckError) throw regCheckError;

          if (!existingReg || existingReg.length === 0) {
            const { error: regInsError } = await supabase
              .from('event_registrations')
              .insert({
                vendor_id: vendorId,
                event_id: evId,
                region_id: homeRegionId,
                registration_status: 'confirmed',
                collection_status: v.employeeCount ? 'collected' : 'pending',
                paid: Number(v.amountPaid) > 0
              });
            if (regInsError) throw regInsError;
          }
        }
      }
    }

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed with error:", error);
  }
}

seed();
