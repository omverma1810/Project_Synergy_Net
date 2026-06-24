"""Populate geographic coordinates and local-support (film commission /
government board / industry association) data on existing territories.

Keyed by country_code so it updates whatever territory set is already seeded
(seed_demo's 16 or seed_territories' 5) without creating duplicates.
"""
from django.core.management.base import BaseCommand
from territories.models import Territory

# country_code -> geo + local-support profile
GEO_GOV = {
    'SA': {
        'latitude': 24.71355, 'longitude': 46.67529,
        'film_commission': 'Saudi Film Commission',
        'film_commission_url': 'https://www.saudifilm.sa',
        'government_support': 'Federal cash rebate administered by the Saudi Film Commission (Ministry of Culture). Film AlUla offers an additional production-services pipeline, locations and studio support. Fast-tracked permits for foreign productions.',
        'local_associations': [
            {'name': 'Film AlUla', 'url': 'https://www.film.alula.com'},
            {'name': 'Red Sea Film Foundation', 'url': 'https://www.redseafilmfest.com'},
        ],
    },
    'BE': {
        'latitude': 50.85034, 'longitude': 4.35171,
        'film_commission': 'Screen Flanders / Screen Brussels',
        'film_commission_url': 'https://www.screenflanders.be',
        'government_support': 'Federal Tax Shelter (private investor scheme) stacks with regional economic funds — Screen Flanders, Screen.Brussels and Wallimage — each providing repayable/soft funding tied to regional spend.',
        'local_associations': [
            {'name': 'Flanders Audiovisual Fund (VAF)', 'url': 'https://www.vaf.be'},
            {'name': 'Wallimage', 'url': 'https://www.wallimage.be'},
        ],
    },
    'GB': {
        'latitude': 51.50735, 'longitude': -0.12776,
        'film_commission': 'British Film Commission',
        'film_commission_url': 'https://britishfilmcommission.org.uk',
        'government_support': 'Audio-Visual Expenditure Credit (AVEC) administered by HMRC; the BFI runs the cultural test certification. The British Film Commission provides free location, studio and tax-relief navigation for inbound productions.',
        'local_associations': [
            {'name': 'British Film Institute (BFI)', 'url': 'https://www.bfi.org.uk'},
            {'name': 'Pact', 'url': 'https://www.pact.co.uk'},
        ],
    },
    'GB_HETV': {
        'latitude': 51.50735, 'longitude': -0.12776,
        'film_commission': 'British Film Commission',
        'film_commission_url': 'https://britishfilmcommission.org.uk',
        'government_support': 'High-End TV credit under AVEC (min £1M per broadcast hour). BFI cultural test certification; British Film Commission supports studio capacity and crew.',
        'local_associations': [
            {'name': 'British Film Institute (BFI)', 'url': 'https://www.bfi.org.uk'},
            {'name': 'Pact', 'url': 'https://www.pact.co.uk'},
        ],
    },
    'IE': {
        'latitude': 53.34980, 'longitude': -6.26030,
        'film_commission': 'Screen Ireland (Fís Éireann)',
        'film_commission_url': 'https://www.screenireland.ie',
        'government_support': 'Section 481 tax credit administered by Revenue, with a regional uplift. Screen Ireland provides development/production funding and a national film commission service.',
        'local_associations': [
            {'name': 'Screen Producers Ireland', 'url': 'https://www.screenproducersireland.com'},
        ],
    },
    'ES_CI': {
        'latitude': 28.46362, 'longitude': -16.25184,
        'film_commission': 'Canary Islands Film',
        'film_commission_url': 'https://www.canaryislandsfilm.com',
        'government_support': 'Enhanced Spanish deduction within the Canary Islands Special Zone (ZEC) — among the EU’s highest rebates. Regional film commission coordinates permits and the local production-services network.',
        'local_associations': [
            {'name': 'Spain Film Commission', 'url': 'https://www.shootinginspain.info'},
        ],
    },
    'HU': {
        'latitude': 47.49791, 'longitude': 19.04023,
        'film_commission': 'National Film Institute Hungary (NFI)',
        'film_commission_url': 'https://nfi.hu/en',
        'government_support': 'Indirect tax incentive administered by the NFI Tax Rebate office; one of Europe’s most efficient cash-back systems with large studio capacity in Budapest.',
        'local_associations': [
            {'name': 'Origo Studios', 'url': 'https://www.origostudios.com'},
        ],
    },
    'RS': {
        'latitude': 44.78657, 'longitude': 20.44890,
        'film_commission': 'Film in Serbia (Film Center Serbia)',
        'film_commission_url': 'https://www.filminserbia.com',
        'government_support': 'Cash rebate paid by the Ministry of Economy via Film Center Serbia, with an uplift for high-spend productions. Streamlined single-window application.',
        'local_associations': [
            {'name': 'Film Center Serbia', 'url': 'https://www.fcs.rs/en'},
        ],
    },
    'AU': {
        'latitude': -33.86880, 'longitude': 151.20930,
        'film_commission': 'Ausfilm / Screen Australia',
        'film_commission_url': 'https://www.ausfilm.com.au',
        'government_support': 'Federal Location Offset (with a Location Incentive top-up) administered by the Office for the Arts; state agencies (e.g. Screen NSW, Film Victoria) add competitive grants. Ausfilm is the inbound liaison.',
        'local_associations': [
            {'name': 'Screen Australia', 'url': 'https://www.screenaustralia.gov.au'},
            {'name': 'Ausfilm', 'url': 'https://www.ausfilm.com.au'},
        ],
    },
    'AU_PDV': {
        'latitude': -33.86880, 'longitude': 151.20930,
        'film_commission': 'Ausfilm / Screen Australia',
        'film_commission_url': 'https://www.ausfilm.com.au',
        'government_support': 'Post, Digital and Visual effects (PDV) Offset for work done in Australia regardless of where shooting occurs; stacks with state PDV incentives in NSW, VIC and QLD.',
        'local_associations': [
            {'name': 'Screen Australia', 'url': 'https://www.screenaustralia.gov.au'},
            {'name': 'Ausfilm', 'url': 'https://www.ausfilm.com.au'},
        ],
    },
    'AE': {
        'latitude': 24.45385, 'longitude': 54.37734,
        'film_commission': 'Abu Dhabi Film Commission (twofour54)',
        'film_commission_url': 'https://www.creativemediaauthority.com',
        'government_support': 'Up to 30% cash-back rebate via twofour54 / Creative Media Authority, plus production-services and studio infrastructure. Dubai offers a separate commission and permits regime.',
        'local_associations': [
            {'name': 'Dubai Film and TV Commission', 'url': 'https://www.filmdubai.gov.ae'},
        ],
    },
    'CA': {
        'latitude': 45.42153, 'longitude': -75.69719,
        'film_commission': 'Telefilm Canada / CAVCO',
        'film_commission_url': 'https://telefilm.ca',
        'government_support': 'Federal Production Services Tax Credit (PSTC) certified by CAVCO, designed to stack with provincial credits. Telefilm coordinates national support; provinces administer their own offices.',
        'local_associations': [
            {'name': 'Canadian Media Producers Association (CMPA)', 'url': 'https://cmpa.ca'},
        ],
    },
    'CA_BC': {
        'latitude': 49.28273, 'longitude': -123.12074,
        'film_commission': 'Creative BC',
        'film_commission_url': 'https://www.creativebc.com',
        'government_support': 'British Columbia Production Services Tax Credit stacks on top of the federal PSTC, with regional and DAVE (digital/VFX) uplifts. Creative BC runs the provincial film commission.',
        'local_associations': [
            {'name': 'Motion Picture Production Industry Association of BC (MPPIA)', 'url': 'https://www.mppia.ca'},
        ],
    },
    'MA': {
        'latitude': 30.91952, 'longitude': -6.89340,
        'film_commission': 'Centre Cinématographique Marocain (CCM)',
        'film_commission_url': 'https://www.ccm.ma',
        'government_support': 'National cash rebate administered by the CCM. Ouarzazate offers world-class desert locations and established studio infrastructure (Atlas, CLA) with deep, low-cost below-the-line crews.',
        'local_associations': [
            {'name': 'Ouarzazate Film Commission', 'url': 'https://www.ccm.ma'},
        ],
    },
    'PL': {
        'latitude': 52.22977, 'longitude': 21.01178,
        'film_commission': 'Polish Film Institute (PISF)',
        'film_commission_url': 'https://pisf.pl/en',
        'government_support': 'Cash rebate administered by the Polish Film Institute (PISF), capped per project. Film Commission Poland coordinates a network of regional funds and location services.',
        'local_associations': [
            {'name': 'Film Commission Poland', 'url': 'https://filmcommissionpoland.pl'},
        ],
    },
    'RO': {
        'latitude': 44.42676, 'longitude': 26.10254,
        'film_commission': 'Romanian Film Centre (CNC)',
        'film_commission_url': 'https://cnc.gov.ro',
        'government_support': 'State-aid cash rebate (administered via the Ofic.ro scheme) with an uplift for productions promoting Romania. Min. local spend and crew thresholds apply.',
        'local_associations': [
            {'name': 'Romanian Film Commission', 'url': 'https://cnc.gov.ro'},
        ],
    },
}


class Command(BaseCommand):
    help = 'Populate geo coordinates and film-commission / government data on territories.'

    def handle(self, *args, **kwargs):
        updated, missing = 0, []
        for code, data in GEO_GOV.items():
            try:
                t = Territory.objects.get(country_code=code)
            except Territory.DoesNotExist:
                missing.append(code)
                continue
            for field, value in data.items():
                setattr(t, field, value)
            t.save(update_fields=list(data.keys()))
            updated += 1
            self.stdout.write(f'  Updated: {t.name} ({code})')

        if missing:
            self.stdout.write(self.style.WARNING(f'  Not found (skipped): {", ".join(missing)}'))
        self.stdout.write(self.style.SUCCESS(f'\nDone — {updated} territories enriched.'))
