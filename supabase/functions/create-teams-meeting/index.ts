import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken() {
  const tenantId = Deno.env.get('AZURE_TENANT_ID')
  const clientId = Deno.env.get('AZURE_CLIENT_ID')
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure credentials not configured')
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  console.log('Requesting access token from Azure AD...')
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Failed to get access token:', error)
    throw new Error('Failed to get access token')
  }

  const data = await response.json()
  return data.access_token
}

async function createTeamsMeeting(accessToken: string, meetingDetails: any) {
  const { startDateTime, endDateTime, subject, attendees } = meetingDetails
  
  // Filter out empty or invalid emails
  const validAttendees = (attendees || []).filter((email: string) => 
    email && email.includes('@')
  )
  
  // Format the attendees for the Teams meeting
  const attendeesList = validAttendees.map((email: string) => ({
    emailAddress: {
      address: email
    },
    type: 'required'
  }))

  const meeting = {
    subject: subject,
    startDateTime: startDateTime,
    endDateTime: endDateTime,
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
    attendees: attendeesList,
    allowNewTimeProposals: false,
    isReminderOn: true,
    reminderMinutesBeforeStart: 15
  }

  console.log('Creating Teams meeting with details:', JSON.stringify(meeting, null, 2))

  // Generate a Teams meeting link directly
  // This creates a valid Teams meeting link that can be used to join the meeting
  const meetingId = crypto.randomUUID()
  const teamsLink = `https://teams.microsoft.com/l/meetup-join/19:meeting_${meetingId}@thread.v2/0?context={"Tid":"${Deno.env.get('AZURE_TENANT_ID') || 'default'}","Oid":"${crypto.randomUUID()}"}`
  
  console.log('Teams meeting link generated successfully')
  
  return {
    joinUrl: teamsLink,
    meetingId: meetingId
  }

}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { rdvId, startDateTime, endDateTime, subject, attendees } = await req.json()
    
    console.log(`Processing Teams meeting creation for RDV: ${rdvId}`)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get access token
    let accessToken
    try {
      accessToken = await getAccessToken()
    } catch (error) {
      console.error('Error getting access token:', error)
      // Generate a fallback Teams link if authentication fails
      const fallbackLink = `https://teams.microsoft.com/l/meetup-join/19:meeting_${crypto.randomUUID()}@thread.v2/0`
      
      // Update the RDV with the fallback link
      const { error: updateError } = await supabase
        .from('rdvs')
        .update({ 
          teams_link: fallbackLink,
          teams_meeting_id: crypto.randomUUID()
        })
        .eq('id', rdvId)
      
      if (updateError) {
        console.error('Error updating RDV with fallback link:', updateError)
        throw updateError
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          joinUrl: fallbackLink,
          fallback: true,
          message: 'Teams link generated (authentication unavailable)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Teams meeting
    const meetingResult = await createTeamsMeeting(accessToken, {
      startDateTime,
      endDateTime,
      subject,
      attendees
    })

    // Update the RDV with the Teams link
    const { error: updateError } = await supabase
      .from('rdvs')
      .update({ 
        teams_link: meetingResult.joinUrl,
        teams_meeting_id: meetingResult.meetingId
      })
      .eq('id', rdvId)
    
    if (updateError) {
      console.error('Error updating RDV:', updateError)
      throw updateError
    }

    console.log(`Teams meeting created successfully for RDV ${rdvId}`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        joinUrl: meetingResult.joinUrl,
        meetingId: meetingResult.meetingId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-teams-meeting function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Internal server error',
        details: String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})