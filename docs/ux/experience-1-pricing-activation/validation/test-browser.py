from playwright.sync_api import sync_playwright, expect
from browser_harness import mount
from pathlib import Path
import json, traceback
checks=[];screens=Path(__file__).parent/'screens'
def check(name,condition=True):
    assert condition,name
    checks.append({'name':name,'status':'PASS'})
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    def new(search='view=editor',width=1440):
        page=b.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(4500)
        page.on('pageerror',lambda e: print('PAGEERROR',str(e)))
        mount(page,search);return page
    try:
        page=new()
        value=page.get_by_label('Test area (m²)',exact=True);value.fill('120');value.press('Enter')
        expect(page.locator('.qc-test-total')).to_contain_text('£1,128.00');check('Enter calculates with unsaved settings')
        check('Calculate never invokes save callback',page.evaluate('fixtureCalls.every(c=>c.kind!=="submit")'))
        check('All test input/select controls detached from parent form',page.locator('[data-qc-component="C70"] input,[data-qc-component="C70"] select').evaluate_all('els=>els.every(e=>e.form===null && !e.name)'))
        page.get_by_label('Labour cost per m² (GBP)',exact=True).fill('5');expect(page.locator('.qc-test-total')).to_contain_text('£1,260.00');check('Changed unsaved cost updates live result')
        page.get_by_role('button',name='Close component test').click();expect(page.get_by_role('button',name='Test component',exact=True)).to_be_focused();check('Close restores focus to test toggle')
        page.get_by_role('button',name='Test component',exact=True).click();expect(value).to_have_value('120');check('Hide/show preserves test measurement and result')
        value.fill('-1');expect(page.locator('.qc-test-total')).to_have_count(0);expect(page.locator('#root')).to_contain_text('enter a number above zero');check('Invalid sample removes stale result')
        page.get_by_role('button',name='Save component',exact=True).click();page.wait_for_timeout(150);check('Invalid sample does not block valid component saving',page.evaluate('fixtureCalls.filter(c=>c.kind==="submit").length===1'))
        payload=page.evaluate('fixtureCalls.find(c=>c.kind==="submit").fields');check('FormData has original payload controls only',set(payload)=={'name','sku','measurement_type','default_material_rate','default_labour_rate','default_waste_type','waste_amount','default_pitch_type','eligible_for_orders'})
        value.fill('120');page.get_by_role('button',name='Calculate again',exact=True).click()
        page.get_by_label('Measurement basis',exact=True).select_option('plan');expect(page.locator('.qc-test-total')).to_have_count(0);check('Plan measurement requires pitch instead of assuming it')
        page.get_by_label('Pitch (degrees)',exact=True).fill('25');expect(page.locator('.qc-test-total')).to_be_visible();check('Plan pitch recalculates through current draft')
        page.get_by_label('Apply pitch calculation',exact=True).uncheck();expect(page.get_by_label('Pitch (degrees)',exact=True)).to_have_count(0);expect(page.locator('.qc-test-total')).to_contain_text('£1,260.00');check('Turning pitch off hides input and removes adjustment')
        page.get_by_label('Test measurement units',exact=True).select_option('imperial_ft');expect(page.get_by_label('Test area (ft²)',exact=True)).to_have_value('');expect(page.locator('.qc-test-total')).to_have_count(0);check('Unit change never reinterprets old number as new units')
        page.close()
        page=new('view=list&guide=off')
        expect(page.get_by_role('button',name='Open and test Roofing underlay')).to_be_visible();page.get_by_role('button',name='Open and test Roofing underlay').click();expect(page.get_by_label('Test area (m²)',exact=True)).to_be_visible();check('Real library row opens stable editor with test panel')
        page.get_by_label('Test area (m²)',exact=True).fill('120');page.get_by_role('button',name='Calculate',exact=True).click();expect(page.locator('.qc-test-total')).to_contain_text('£1,128.00')
        page.get_by_label('Component name',exact=True).fill('My underlay')
        page.get_by_role('button',name='Open and test Ridge capping').click();expect(page.get_by_role('dialog')).to_be_visible();expect(page.get_by_role('button',name='Keep editing',exact=True)).to_be_visible();page.get_by_role('button',name='Keep editing',exact=True).click();expect(page.get_by_label('Component name',exact=True)).to_have_value('My underlay');check('Switching components cannot silently drop dirty settings')
        page.get_by_role('button',name='Use these settings for a new component',exact=True).click();expect(page.get_by_label('Component name',exact=True)).to_have_value('My underlay (copy)');expect(page.get_by_label('Product code / SKU (optional)',exact=True)).to_have_value('');check('Use as starting point copies draft settings and clears unique SKU')
        page.get_by_role('button',name='Test component',exact=True).click();page.get_by_label('Test area (m²)',exact=True).fill('120');page.get_by_role('button',name='Calculate',exact=True).click();expect(page.locator('.qc-test-total')).to_contain_text('£1,128.00');check('Copied draft tests before saving')
        page.evaluate('window.fixtureDelay=350');page.get_by_role('button',name='Save component',exact=True).click();expect(page.get_by_label('Component name',exact=True)).to_be_disabled();check('Pending save freezes editing until real response')
        expect(page.get_by_role('button',name='Open and test My underlay (copy)')).to_be_visible();saved=page.evaluate('fixtureCalls.find(c=>c.kind==="create").input')
        check('Real create callback retains pack/waste/labour fields',saved['pack_size']==50 and saved['pack_price']==200 and saved['default_waste_percent']==10 and saved['default_labour_rate']==4 and saved['pricing_strategy']=='per_pack_area' and saved['collection_id']=='lib-1')
        check('Real create callback gets no tester data',not any(k in saved for k in ['values','pitch','basis','system','testMeasurement']))
        page.get_by_role('button',name='How Smart Components work',exact=True).click();expect(page.locator('[data-qc-component="C71"]')).to_contain_text("created and tested a component in this visit");check('Learning milestones reflect actual test plus save, not presence')
        page.close()
        page=new('view=list&guide=off')
        page.get_by_role('button',name='+ Create component',exact=True).click();page.get_by_label('Component name',exact=True).fill('My labour only')
        page.get_by_label('Material cost per m² (GBP)',exact=True).fill('0');page.get_by_label('Labour cost per m² (GBP)',exact=True).fill('5')
        page.evaluate('window.fixtureFail=true');page.get_by_role('button',name='Save component',exact=True).click();expect(page.locator('.qc-component-editor [role="alert"]')).to_contain_text('Fixture save failure');expect(page.get_by_label('Component name',exact=True)).to_have_value('My labour only');check('Create failure keeps unsaved values and truthful error')
        page.evaluate('window.fixtureFail=false;window.fixtureCap=true');page.get_by_role('button',name='Save component',exact=True).click();expect(page.locator('body')).to_contain_text('saved as inactive');check('At-cap result is saved inactive, never claimed ready')
        page.close()
        page=new('view=list&guide=off&blocked=true');page.get_by_role('button',name='+ Create component',exact=True).click();expect(page.locator('body')).to_contain_text('subscription');check('Inactive subscription still blocks creation',page.locator('.qc-component-editor').count()==0);page.close()
        page=new('view=list&guide=off&warn=true');page.get_by_role('button',name='Open and test Roofing underlay').click();page.get_by_label('Labour cost per m² (GBP)',exact=True).fill('6');page.get_by_role('button',name='Save component',exact=True).click();expect(page.get_by_role('dialog')).to_be_visible();check('Existing edit warning remains before update',page.evaluate('!fixtureCalls.some(c=>c.kind==="update")'));page.close()
        page=new('view=list&guide=off&generic=false');page.get_by_role('button',name='Open and test Roofing underlay').click();expect(page.get_by_label('How do you buy the material?',exact=True)).to_have_count(0);page.get_by_label('Test area (m²)',exact=True).fill('120');page.get_by_role('button',name='Calculate',exact=True).click();expect(page.locator('.qc-test-total')).to_contain_text('£1,128.00');check('Flag-off stored pack tests without enabling gated controls')
        page.get_by_label('Labour cost per m² (GBP)',exact=True).fill('5');page.get_by_role('button',name='Save component',exact=True).click();saved=page.evaluate('fixtureCalls.find(c=>c.kind==="update").input');check('Flag-off save does not overwrite protected generic pack data',not any(k in saved for k in ['pricing_strategy','pack_price','pack_size','height_value_mm']));page.close()
        page=new('view=home');check('Known empty work offers pricing first',page.locator('.qc-home-start [data-qc-variant="primary"]').get_attribute('href').endswith('/components?learn=1'));page.screenshot(path=str(screens/'home-pricing-1440.png'),full_page=True);page.close()
        page=new('view=home&work=exists');check('Existing work offers real continue route, not signup instructions',page.locator('.qc-home-start [data-qc-variant="primary"]').get_attribute('href').endswith('/quotes/job-1'));page.close()
        page=new('view=home&work=unknown');check('Unknown read does not imply no jobs',page.locator('.qc-home-start [data-qc-variant="primary"]').inner_text().find('New quote')>=0);page.close()
        page=new('view=import');page.get_by_role('button',name='Supplier price list',exact=False).click();expect(page.locator('.qc-catalogue-example')).to_contain_text('Roofing underlay');check('Real mapping shows same selected source row')
        page.get_by_label('Column for Component Name',exact=True).select_option('Code');expect(page.locator('.qc-catalogue-example dd').first).to_have_text('UNDERLAY-50');check('Changing mapping updates worked row immediately')
        page.get_by_label('Column for Component Name',exact=True).select_option('Product');page.get_by_label('Filter rows...',exact=True).fill('12');expect(page.locator('body')).to_contain_text('Ridge capping');check('CSV numeric cells searchable without type crash');page.get_by_label('Filter rows...',exact=True).fill('')
        page.get_by_role('button',name='Next: Choose Library',exact=False).click();expect(page.locator('body')).to_contain_text('Missing prices must be reviewed.');check('Import clearly leaves advanced component setup for later')
        page.evaluate('window.fixtureDelay=400');page.get_by_role('button',name='Create 3 Components',exact=True).click();expect(page.get_by_role('button',name='Creating components, please wait',exact=True)).to_be_disabled();check('Import pending cannot be mistaken for cancelled request')
        expect(page.get_by_role('button',name='Review components',exact=True)).to_be_visible();check('Success stays visible instead of immediately reloading parent',page.evaluate('fixtureCalls.some(c=>c.kind==="catalogueCreated") && !fixtureCalls.some(c=>c.kind==="catalogueClose")'))
        check('Import uses original mapping/payload contract',page.evaluate('fixtureCalls.find(c=>c.kind==="convert").input.columnMapping.Cost[0]==="price"'))
        page.get_by_role('button',name='Review components',exact=True).click();check('Review exits on deliberate action',page.evaluate('fixtureCalls.some(c=>c.kind==="catalogueClose")'));page.close()
        page=new('view=intro');page.evaluate('window.fixtureFail=true');page.get_by_role('button',name='Hide pricing introduction',exact=True).click();expect(page.locator('[role="status"]')).to_contain_text('Could not remember');check('Personal intro preference failure is not hidden');page.get_by_role('button',name='Hide for now').click();expect(page.get_by_role('button',name='How Smart Components work')).to_be_visible();check('Guide dismissible for visit without fake persistence');page.close()
        for width in [1440,1024,768,390,320]:
            for view in ['editor','intro','home','list']:
                page=new('view='+view,width)
                if view=='editor':
                    page.get_by_label('Test area (m²)',exact=True).fill('120');page.get_by_role('button',name='Calculate',exact=True).click()
                check(f'{view} {width}px no page-wide overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                if width in[1440,390,320]: page.screenshot(path=str(screens/f'{view}-{width}.png'),full_page=True)
                if view=='editor' and width<600:
                    check(f'Editor {width}px readable numeric fields',page.get_by_label('Test area (m²)',exact=True).evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=16'))
                page.close()
        for width in [390,320]:
            page=new('view=editor',width)
            page.get_by_label('Test area (m²)',exact=True).fill('120');page.get_by_role('button',name='Calculate',exact=True).click()
            page.get_by_role('button',name='Settings',exact=True).click();expect(page.get_by_label('Component name',exact=True)).to_be_visible();expect(page.get_by_label('Test area (m²)',exact=True)).not_to_be_visible();check(f'{width}px Settings view hides test without unmounting')
            page.get_by_label('Labour cost per m² (GBP)',exact=True).fill('5');page.get_by_role('button',name='Test component',exact=True).click();expect(page.get_by_label('Test area (m²)',exact=True)).to_have_value('120');expect(page.locator('.qc-test-total')).to_contain_text('£1,260.00');expect(page.get_by_role('button',name='Save component',exact=True)).not_to_be_visible();check(f'{width}px returning to test preserves measurement and recomputes unsaved settings')
            page.get_by_label('Test area (m²)',exact=True).fill('-1');page.get_by_role('button',name='Adjust component settings',exact=True).click();page.get_by_role('button',name='Save component',exact=True).click();check(f'{width}px hidden invalid test cannot block valid save',page.evaluate('fixtureCalls.filter(c=>c.kind==="submit").length===1'));page.screenshot(path=str(screens/f'editor-settings-{width}.png'),full_page=True);page.close()
            page=new('view=import',width);page.get_by_role('button',name='Supplier price list',exact=False).click();expect(page.locator('.qc-catalogue-example')).to_be_visible();check(f'{width}px catalogue mapping stays in viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(screens/f'import-mapping-{width}.png'),full_page=True)
            page.get_by_role('button',name='Next: Choose Library',exact=False).click();page.get_by_role('button',name='Create 3 Components',exact=True).click();expect(page.get_by_role('button',name='Review components',exact=True)).to_be_visible();check(f'{width}px catalogue result and review action reachable',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(screens/f'import-success-{width}.png'),full_page=True);page.close()
        page=new('view=list&guide=off&legacy=true');page.get_by_role('button',name='Open and test Ridge capping').click();page.get_by_role('button',name='Use these settings for a new component',exact=True).click();expect(page.get_by_label('How do you measure it?',exact=True)).to_have_value('lineal');check('Copy of a legacy linear row uses canonical lineal for the new record');page.close()
        print(f'{len(checks)} browser checks PASS')
    except Exception as e:
        checks.append({'name':'ABORT','status':'FAIL','error':str(e)});print(traceback.format_exc());page.screenshot(path=str(screens/'failure.png'),full_page=True)
    finally:
        b.close();(Path(__file__).parent/'browser-results.json').write_text(json.dumps({'scope':'Isolated real source components + React18.2/Chromium; actions/navigation/transport mocked, no Next or live data', 'checks':checks,'passed':sum(c['status']=='PASS' for c in checks),'failed':sum(c['status']=='FAIL' for c in checks)},indent=2))
