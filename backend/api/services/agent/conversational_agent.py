"""
Conversational Agent for Cohort Builder

This agent maintains state across a conversation and intelligently determines
which stage of the workflow to execute based on conversation history.

Improved version based on LangGraph's agent_decide() and route_action() patterns.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

from .agent_service import AgentService

logger = logging.getLogger(__name__)


class ConversationState(BaseModel):
    """Tracks the current state of the conversation
    
    Stage progression (matching LangGraph):
    0: Initial - raw criteria extraction
    1: Entities extracted from criteria
    2: Schema mapping (table.field with ranked_matches)
    3: Concept mapping (value selection with candidates)
    4: Criteria rewritten as expressions
    5: Criteria validated
    6: SQL generated
    7: Query executed
    """
    current_stage: int = 0
    criteria: List[Dict] = []
    entities_extracted: bool = False
    schema_mapped: bool = False
    concepts_mapped: bool = False
    criteria_rewritten: bool = False
    criteria_validated: bool = False
    sql_query: Optional[str] = None
    last_query_results: Optional[Dict] = None
    last_state: Optional[Dict] = None  # For undo functionality


class AgentDecision(BaseModel):
    """Structured decision output from intent classification"""
    thinking: str = Field(..., description="Concise analysis of user intent")
    action: str = Field(..., description="The action to take: advance, edit, clarify, start_new, reject, undo")
    question: Optional[str] = Field(None, description="Clarifying question if action is 'clarify'")
    modifications: Optional[str] = Field(None, description="What needs to be modified if action is 'edit'")


class ConversationalAgent:
    """
    Manages conversational flow for cohort building.
    
    Unlike AgentService which processes discrete stages, this agent:
    - Maintains conversation state across multiple messages
    - Determines next action based on user intent and history
    - Loads atlas files once per session (cached)
    - Provides natural conversational responses
    """
    
    def __init__(self, project_id: str, atlas_id: str, user_id: int):
        self.project_id = project_id
        self.atlas_id = atlas_id
        self.user_id = user_id
        
        # Initialize the underlying agent service (loads atlas files)
        self.agent = AgentService(
            project_id=project_id,
            atlas_id=atlas_id,
            user_id=user_id
        )
        
        # Conversation state
        self.state = ConversationState()
    
    def process_message(
        self,
        user_message: str,
        conversation_history: List[Dict[str, Any]],
        field_mappings: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Process a user message in the context of the conversation.
        
        Args:
            user_message: The user's input message
            conversation_history: List of previous messages
            field_mappings: Optional updated field mappings from UI
            
        Returns:
            Response dict with:
            - response_text: Text response to user
            - ui_components: Optional UI components to display
            - stage: Current stage number
            - metadata: Additional stage-specific data
        """
        
        # Reconstruct state from conversation history
        self._reconstruct_state_from_history(conversation_history)
        
        # If field mappings are provided, update the schema mappings in state
        if field_mappings:
            logger.info(f"Received updated field mappings: {len(field_mappings)} mappings")
            return self._handle_field_mapping_update(field_mappings)
        
        # Determine user intent and next action (using improved logic)
        decision = self._determine_user_intent(user_message, conversation_history)
        
        logger.info(f"Agent decision: {decision['action']}, Current stage: {self.state.current_stage}")
        logger.info(f"Thinking: {decision.get('thinking', 'N/A')}")
        
        # Route to appropriate handler based on action
        action = decision['action']
        
        if action == 'reject':
            return self._handle_reject(user_message)
        
        elif action == 'start_new':
            return self._handle_new_query(user_message)
        
        elif action == 'advance':
            return self._handle_advance()
        
        elif action == 'edit':
            return self._handle_edit(user_message, decision.get('modifications'))
        
        elif action == 'clarify':
            return self._handle_clarify(decision.get('question'))
        
        elif action == 'undo':
            return self._handle_undo()
        
        elif action == 'db_question':
            return self._handle_db_question(user_message)
        
        else:
            # Fallback: provide helpful guidance
            return self._provide_guidance()
    
    def _reconstruct_state_from_history(self, history: List[Dict[str, Any]]):
        """Reconstruct conversation state from message history"""
        for msg in history:
            if msg.get('role') != 'assistant' or not msg.get('metadata'):
                continue
            
            metadata = msg['metadata']
            stage = metadata.get('stage', 0)
            
            # Extract inner metadata (since chat_views.py saves entire response as metadata)
            inner_metadata = metadata.get('metadata', {})
            
            # Update state based on stage data
            if stage == 0 and inner_metadata.get('criteria'):
                self.state.criteria = inner_metadata['criteria']
                self.state.current_stage = 0
            
            elif stage == 1:
                # Criteria with UI components (approved implicitly)
                self.state.criteria = inner_metadata.get('criteria', self.state.criteria)
                self.state.schema_mapped = True
                self.state.current_stage = 1
            
            elif stage == 2:
                # Criteria with concepts and UI components
                self.state.criteria = inner_metadata.get('criteria', self.state.criteria)
                self.state.schema_mapped = True
                self.state.concepts_mapped = True
                self.state.current_stage = 2
            
            elif stage == 3 and inner_metadata.get('sql_query'):
                self.state.sql_query = inner_metadata['sql_query']
                self.state.current_stage = 3
            
            elif stage == 4 and inner_metadata.get('results'):
                self.state.last_query_results = inner_metadata['results']
                self.state.current_stage = 4
    
    def _determine_user_intent(
        self,
        message: str,
        history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use LLM to determine user intent from their message.
        
        Inspired by LangGraph's agent_decide() function, this analyzes conversation
        history and current state to classify user intent more accurately.
        
        Returns action: advance, edit, clarify, or start_new
        """
        
        # Format conversation history
        history_str = "\n".join([
            f"- {msg.get('role', 'unknown')}: {msg.get('content', '')[:150]}"
            for msg in history[-5:]  # Last 5 messages for context
        ])
        
        # Build context with explicit state information
        prompt = f"""You're a biomedical expert agent helping a user build query criteria to retrieve database records.

TASK: Analyze the recent conversation history and current state, then decide on your next action.

<ACTIONS>
- `advance`: User explicitly approves current result and wants to proceed to next step
- `edit`: User provides feedback/modifications to refine the current state
- `clarify`: User input is unclear (acronyms, vague attributes, conflicts) - ask a clarifying question
- `start_new`: User is starting a completely new cohort query with medical/clinical criteria
- `reject`: User input is a greeting, irrelevant, or not related to cohort building (e.g., "hi", "hello", "what's up")
- `undo`: User wants to revert the last change and go back to the previous state (e.g., "undo", "go back", "revert")
- `db_question`: User is asking about the database schema, available fields, tables, or what data is available (e.g., "what tables are available", "what fields can I query", "tell me about the database")
</ACTIONS>

<USER_INPUT_TYPES>
- Initial cohort query (e.g., "Find patients with diabetes")
- Approval to proceed (e.g., "yes", "looks good", "proceed", "next", "continue", "ok", "generate SQL")
- Feedback/edits (e.g., "change age to 50-60", "add hypertension", "remove smoking status")
- Clarifying comment on earlier query
- Irrelevant input unrelated to cohort building
</USER_INPUT_TYPES>

<CURRENT_STATE>
Stage: {self.state.current_stage}
  0: Initial query - extracting raw criteria
  1: Criteria extracted - mapping to database schema
  2: SQL generated - ready for execution
  3: Query executed - showing results

Criteria Count: {len(self.state.criteria)}
Entities Extracted: {self.state.entities_extracted}
Schema Mapped: {self.state.schema_mapped}
Concepts Mapped: {self.state.concepts_mapped}
Criteria Validated: {self.state.criteria_validated}
SQL Generated: {self.state.sql_query is not None}
Query Executed: {self.state.last_query_results is not None}
</CURRENT_STATE>

<CONVERSATION_HISTORY>
{history_str}
</CONVERSATION_HISTORY>

<LATEST_USER_MESSAGE>
{message}
</LATEST_USER_MESSAGE>

IMPORTANT RULES:
1. If user input is a GREETING or IRRELEVANT ("hi", "hello", "hey", "what's up", "how are you") -> action is "reject"
2. If user asks about DATABASE SCHEMA/STRUCTURE ("what tables", "what fields", "what data is available", "describe the database", "what can I query", "show me the schema") -> action is "db_question"
3. If user asks to VIEW/DISPLAY criteria ("show criteria", "what are the criteria", "display criteria", "see criteria", "what do we have", "what's the current criteria", "i want to see the criteria") -> action is "clarify" with question explaining the criteria
4. If user wants to UNDO/REVERT ("undo", "go back", "revert", "undo that", "go back to previous") -> action is "undo"
5. ONLY advance if user EXPLICITLY approves: "yes", "looks good", "proceed", "correct", "approve", "continue", "ok", "okay", "next"
6. If at stage 1 and user says "generate SQL", "create query", "build query" -> action is "advance"
7. If at stage 2 (SQL shown) and user says "run it", "execute", "yes" -> action is "advance"
8. If user provides ANY modifications ("change X", "add Y", "remove Z") -> action is "edit"
9. If user provides a NEW cohort query with medical criteria (diseases, age, gender, etc.) -> action is "start_new"
10. If user input is vague or ambiguous (but NOT asking to see criteria or database) -> action is "clarify"
11. BE CONSERVATIVE: When in doubt between "advance" and "edit", choose "edit"
12. If no criteria exist and user says something non-medical -> action is "reject"

Always respond with strict JSON:
{{
  "thinking": "...",  # Brief analysis of what user wants
  "action": "...",     # One of: advance, edit, clarify, start_new
  "question": "...",   # Only if action is clarify
  "modifications": "..." # Only if action is edit
}}

Response (strict JSON):"""
        
        try:
            response = self.agent._call_llm(
                user_prompt=prompt,
                system_prompt="You are an expert at understanding user intent in conversational cohort building.",
                response_model=AgentDecision
            )
            result = response.dict()
            logger.info(f"LLM decision: {result['action']}, thinking: {result['thinking']}")
            return result
        except Exception as e:
            logger.error(f"Failed to determine intent: {e}")
            # Fallback: analyze message for common patterns
            msg_lower = message.lower().strip()
            
            # Check for "show criteria" type requests
            if any(keyword in msg_lower for keyword in ['show', 'display', 'see', 'view', 'what are', 'what is', 'current']) and \
               any(keyword in msg_lower for keyword in ['criteria', 'criterion', 'filter', 'condition']):
                return {'action': 'clarify', 'thinking': 'User wants to see current criteria', 'question': 'Here are your current criteria:', 'reason': 'Show criteria requested'}
            
            # Check for undo requests
            if any(keyword in msg_lower for keyword in ['undo', 'go back', 'revert', 'undo that', 'go back to previous']):
                return {'action': 'undo', 'thinking': 'User wants to undo last change', 'reason': 'Undo requested'}
            
            # Check for approval keywords
            if any(keyword in msg_lower for keyword in ['yes', 'looks good', 'proceed', 'next', 'continue', 'ok', 'okay', 'correct']):
                return {'action': 'advance', 'thinking': 'User approved current state', 'reason': 'Approval detected'}
            
            # Check for execution keywords when at SQL stage
            if self.state.current_stage == 2 and any(keyword in msg_lower for keyword in ['execute', 'run', 'query']):
                return {'action': 'advance', 'thinking': 'User wants to execute query', 'reason': 'Execution requested'}
            
            # Check for SQL generation keywords when at stage 1
            if self.state.current_stage == 1 and any(keyword in msg_lower for keyword in ['generate sql', 'create query', 'sql']):
                return {'action': 'advance', 'thinking': 'User wants to generate SQL', 'reason': 'SQL generation requested'}
            
            # Check if it looks like a new query (longer message, no current criteria)
            if len(message.split()) > 5 and not self.state.criteria:
                return {'action': 'start_new', 'thinking': 'Looks like a new cohort query', 'reason': 'New query detected'}
            
            # Default to edit if we have criteria
            if self.state.criteria:
                return {'action': 'edit', 'thinking': 'Treating as modification request', 'reason': 'Fallback to edit'}
            
            # Ultimate fallback
            return {'action': 'start_new', 'thinking': 'Starting new query', 'reason': 'Fallback to new query'}
    
    def _handle_new_query(self, message: str) -> Dict[str, Any]:
        """Handle a new cohort query"""
        logger.info("Processing new query")
        
        # Reset state for new query
        self.state.criteria = []
        self.state.entities_extracted = False
        self.state.schema_mapped = False
        self.state.concepts_mapped = False
        self.state.criteria_rewritten = False
        self.state.criteria_validated = False
        self.state.sql_query = None
        self.state.last_query_results = None
        self.state.current_stage = 0
        
        # Stage 0: Extract criteria
        result = self.agent.process_stage_0(message)
        
        self.state.criteria = result.get('criteria', [])
        self.state.current_stage = 0
        
        return {
            'response_text': "I've extracted the following criteria from your query. Please review them carefully:",
            'ui_components': {
                'type': 'criteria_chips',
                'data': result.get('criteria', [])
            },
            'stage': 0,
            'metadata': {
                'criteria': self.state.criteria,  # Explicitly save for reconstruction
                'stage': 0,
                'status': 'Criteria extracted',
                'actions': ['approve', 'edit', 'back']
            },
            'next_prompt': "Are these criteria correct? Say 'yes' to proceed, or tell me what to change (e.g., 'remove female', 'add age > 50')."
        }
    
    def _handle_advance(self) -> Dict[str, Any]:
        """
        User approved current state, advance to next stage.
        
        Stage transitions:
        0 -> 1: Extract criteria -> Map to schema
        1 -> 2: Schema mapped -> Generate SQL
        2 -> 3: SQL generated -> Execute query
        3 -> End: Results shown
        """
        logger.info(f"Advancing from stage {self.state.current_stage}")
        
        if self.state.current_stage == 0:
            # User approved criteria, move to stage 1 (schema mapping ONLY)
            logger.info(f"Stage 0->1: Processing {len(self.state.criteria)} criteria")
            
            # Only do entity extraction and schema mapping, NOT concept mapping or UI generation
            criteria = self.agent._extract_entities(self.state.criteria)
            criteria = self.agent._map_to_schema(criteria)
            
            self.state.criteria = criteria
            logger.info(f"Stage 1: Got {len(self.state.criteria)} criteria with schema mappings")
            self.state.schema_mapped = True
            self.state.current_stage = 1
            
            # Format schema mappings for UI dropdowns
            schema_mappings = []
            for criterion in self.state.criteria:
                logger.info(f"Criterion: {criterion.get('text', 'NO TEXT')}, db_mappings: {criterion.get('db_mappings', {}).keys()}")
                for entity, mapping in criterion.get('db_mappings', {}).items():
                    logger.info(f"  Entity '{entity}': has ranked_matches: {'ranked_matches' in mapping if mapping else False}")
                    if mapping and 'ranked_matches' in mapping:
                        schema_mappings.append({
                            'entity': entity,
                            'attribute': mapping.get('attribute', ''),
                            'criterion_text': criterion.get('text', ''),
                            'selected': mapping.get('table.field'),  # Currently selected
                            'options': mapping.get('ranked_matches', []),  # Dropdown options
                            'field_description': mapping.get('field_description', '')
                        })
            
            # Check if we have any schema mappings to show
            logger.info(f"Schema mappings array has {len(schema_mappings)} items")
            for idx, mapping in enumerate(schema_mappings):
                logger.info(f"  Mapping {idx}: entity={mapping.get('entity')}, selected={mapping.get('selected')}, options count={len(mapping.get('options', []))}")
            
            if not schema_mappings:
                return {
                    'response_text': "I couldn't find any database field mappings for your criteria. The schema mapping process didn't return ranked matches. This might be a configuration issue with the agent service.",
                    'ui_components': {
                        'type': 'error',
                        'data': {
                            'message': 'No schema mappings found',
                            'criteria_count': len(self.state.criteria)
                        }
                    },
                    'stage': 1,
                    'metadata': {
                        'criteria': self.state.criteria,
                        'stage': 1,
                        'status': 'Schema mapping failed - no ranked matches',
                        'actions': ['back']
                    },
                    'next_prompt': "Please try rephrasing your query or contact support."
                }
            
            return {
                'response_text': "Great! I've mapped your criteria to the database schema. You can adjust the field mappings using the dropdowns below:",
                'ui_components': {
                    'type': 'schema_mapping',
                    'data': schema_mappings
                },
                'stage': 1,
                'metadata': {
                    'criteria': self.state.criteria,  # Save criteria WITH db_mappings for reconstruction
                    'stage': 1,
                    'status': 'Schema mapped',
                    'actions': ['approve', 'edit_dropdown', 'back']
                },
                'next_prompt': "Review the field mappings. You can change them using the dropdowns, or say 'continue' to proceed to value selection."
            }
        
        elif self.state.current_stage == 1:
            # User approved schema mapping, now do concept mapping and generate UI components
            logger.info(f"Stage 1->2: Mapping concepts for {len(self.state.criteria)} criteria")
            
            # Now do concept mapping and UI component generation
            from .ui_component_generator import generate_ui_components
            criteria = self.agent._map_to_concepts(self.state.criteria)
            
            # Debug: Check if mapped_concept exists after _map_to_concepts
            for crit in criteria:
                for entity, mapping in crit.get('db_mappings', {}).items():
                    logger.info(f"After _map_to_concepts: entity='{entity}', mapped_concept={mapping.get('mapped_concept')}")
            
            criteria = generate_ui_components(criteria, self.agent.schema, self.agent.concept_df)
            
            # Debug: Check if mapped_concept still exists after generate_ui_components
            for crit in criteria:
                for entity, mapping in crit.get('db_mappings', {}).items():
                    logger.info(f"After generate_ui_components: entity='{entity}', mapped_concept={mapping.get('mapped_concept')}")
            
            self.state.criteria = criteria
            self.state.concepts_mapped = True
            self.state.current_stage = 2
            
            logger.info(f"Stage 2: Generated UI components for {len(self.state.criteria)} criteria")
            
            return {
                'response_text': "Perfect! Now select the specific values for each criterion using the controls below:",
                'ui_components': {
                    'type': 'criteria_form',
                    'data': self.state.criteria
                },
                'stage': 2,
                'metadata': {
                    'criteria': self.state.criteria,
                    'stage': 2,
                    'status': 'Concepts mapped - ready for value selection',
                    'actions': ['generate_sql', 'edit', 'back']
                },
                'next_prompt': "Adjust the values using the controls, or say 'generate SQL' when ready."
            }
        
        elif self.state.current_stage == 2:
            # User approved values, move to stage 3 (SQL generation)
            # First, sync criteria with field mappings database
            logger.info("Syncing agent-finalized criteria with field mappings database")
            self.sync_criteria_with_field_mappings()
            
            result = self.agent.process_stage_2(self.state.criteria)
            
            self.state.sql_query = result.get('sql_query')
            self.state.current_stage = 3
            
            if not result.get('validation', {}).get('valid', True):
                return {
                    'response_text': "I encountered some issues generating the SQL:",
                    'ui_components': {
                        'type': 'validation_errors',
                        'data': result.get('validation', {})
                    },
                    'stage': 3,
                    'metadata': result,
                    'next_prompt': "Please go back and adjust your criteria."
                }
            
            return {
                'response_text': "Here's the SQL query I've generated:",
                'ui_components': {
                    'type': 'sql_preview',
                    'data': {
                        'sql_query': result.get('sql_query'),
                        'explanation': result.get('sql_explanation')
                    }
                },
                'stage': 3,
                'metadata': result,
                'next_prompt': "Would you like me to execute this query?"
            }
        
        elif self.state.current_stage == 3:
            # User wants to execute, move to stage 4 (execution)
            if not self.state.sql_query:
                return {
                    'response_text': "No SQL query to execute. Please generate SQL first.",
                    'stage': self.state.current_stage,
                    'metadata': {}
                }
            
            result = self.agent.process_stage_3(self.state.sql_query)
            
            # Check if execution failed
            if not result or result.get('execution', {}).get('status') == 'error':
                error_msg = result.get('execution', {}).get('error', 'Unknown error') if result else 'Query execution failed'
                
                # Check if it's an invalid SQL that needs regeneration
                if 'undefined columns' in error_msg.lower() or 'please regenerate' in error_msg.lower():
                    # Clear invalid SQL and go back to stage 2
                    self.state.sql_query = None
                    self.state.current_stage = 2
                    
                    return {
                        'response_text': f"{error_msg}\n\nI've reset back to stage 2. Say 'generate SQL' to create a new query with the correct column names.",
                        'stage': 2,
                        'ui_components': {
                            'type': 'criteria_form',
                            'data': self.state.criteria
                        },
                        'metadata': {
                            'criteria': self.state.criteria,
                            'stage': 2,
                            'needs_regeneration': True
                        },
                        'next_prompt': "Say 'generate SQL' when ready to create the corrected query."
                    }
                
                return {
                    'response_text': f"Failed to execute query: {error_msg}",
                    'stage': self.state.current_stage,
                    'metadata': result or {'error': error_msg}
                }
            
            self.state.last_query_results = result.get('results')
            self.state.current_stage = 4
            
            total_count = result.get('results', {}).get('total_count', 0) if result.get('results') else 0
            
            return {
                'response_text': f"Query executed successfully! Found {total_count} patients matching your criteria.",
                'ui_components': {
                    'type': 'query_results',
                    'data': result.get('results')
                },
                'stage': 4,
                'metadata': result,
                'next_prompt': "Would you like to download the results or start a new query?"
            }
        
        else:
            # Already at final stage
            return {
                'response_text': "We've completed the query! Would you like to start a new query?",
                'stage': self.state.current_stage,
                'metadata': {}
            }
    
    def _handle_edit(self, message: str, modifications: Optional[str]) -> Dict[str, Any]:
        """User wants to modify current state"""
        logger.info(f"Handling edit at stage {self.state.current_stage}")

        # Save current state for undo
        self.state.last_state = {
            'current_stage': self.state.current_stage,
            'criteria': self.state.criteria.copy(),
            'entities_extracted': self.state.entities_extracted,
            'schema_mapped': self.state.schema_mapped,
            'concepts_mapped': self.state.concepts_mapped,
            'criteria_rewritten': self.state.criteria_rewritten,
            'criteria_validated': self.state.criteria_validated,
            'sql_query': self.state.sql_query
        }
        
        if self.state.current_stage == 0:
            # Check if this is a deletion request
            msg_lower = message.lower().strip()
            
            # Keywords that indicate deletion
            delete_keywords = ['remove', 'delete', 'drop', 'take out', 'get rid of']
            is_delete = any(keyword in msg_lower for keyword in delete_keywords)
            
            if is_delete:
                # Extract what to delete
                for keyword in delete_keywords:
                    if keyword in msg_lower:
                        # Get the text after the keyword
                        delete_text = msg_lower.split(keyword, 1)[1].strip()
                        break
                
                # Find and remove matching criteria
                updated_criteria = []
                removed = False
                for crit in self.state.criteria:
                    crit_text = crit.get('text', '').lower()
                    crit_label = crit.get('chip', {}).get('label', '').lower()
                    
                    # Check if this criterion matches what user wants to delete
                    if delete_text not in crit_text and delete_text not in crit_label:
                        updated_criteria.append(crit)
                    else:
                        removed = True
                        logger.info(f"Removing criterion: {crit.get('text')}")
                
                self.state.criteria = updated_criteria
                
                if removed:
                    response_text = f"I've removed the criterion matching '{delete_text}'."
                else:
                    response_text = f"I couldn't find a criterion matching '{delete_text}' to remove."
                
                return {
                    'response_text': response_text,
                    'ui_components': {
                        'type': 'criteria_chips',
                        'data': updated_criteria
                    },
                    'stage': 0,
                    'metadata': {
                        'stage': 0,
                        'criteria': updated_criteria,
                        'status': 'Criteria updated',
                        'actions': ['approve', 'edit', 'add_criterion']
                    },
                    'next_prompt': "Do these look better? Say 'yes' to proceed or make more changes."
                }
            
            # Check if user is adding new criteria
            msg_lower = message.lower().strip()
            add_keywords = ['add', 'also', 'and']
            is_add = any(keyword in msg_lower for keyword in add_keywords)
            
            logger.info(f"Edit handler: message='{message}', is_add={is_add}, has_criteria={len(self.state.criteria) > 0}")
            
            if is_add and self.state.criteria:
                # User wants to ADD to existing criteria
                # Build context with existing criteria
                existing_criteria_text = "\n".join([
                    f"- {crit.get('type', 'include').upper()}: {crit.get('text', '')}"
                    for crit in self.state.criteria
                ])
                
                # Extract only NEW criteria from the user's message
                feedback = f"""IMPORTANT: The user already has these criteria:
{existing_criteria_text}

USER'S NEW REQUEST: {modifications or message}

TASK: Extract ONLY the NEW criteria mentioned in the user's request above.
Do NOT include any of the existing criteria listed above.
Only extract what is NEW in the user's request.

Example:
If existing criteria include "have diabetes" and user says "add hypertension",
you should ONLY extract "have hypertension" as a new criterion."""
                
                result = self.agent.process_stage_0("", feedback=feedback)
                new_criteria = result.get('criteria', [])
                
                logger.info(f"Extracted {len(new_criteria)} new criteria to append to {len(self.state.criteria)} existing")
                
                # Append new criteria to existing ones (with unique IDs)
                next_id = len(self.state.criteria)
                for idx, crit in enumerate(new_criteria):
                    crit['id'] = f"c{next_id + idx}"
                
                self.state.criteria.extend(new_criteria)
                
                logger.info(f"After append: total {len(self.state.criteria)} criteria")
                
                return {
                    'response_text': f"I've added {len(new_criteria)} new criterion/criteria to your existing ones:",
                    'ui_components': {
                        'type': 'criteria_chips',
                        'data': self.state.criteria
                    },
                    'stage': 0,
                    'metadata': {
                        'stage': 0,
                        'criteria': self.state.criteria,
                        'status': 'Criteria updated',
                        'actions': ['approve', 'edit', 'add_criterion']
                    },
                    'next_prompt': "Do these look good? Say 'yes' to proceed or make more changes."
                }
            else:
                # Check if user wants to REPLACE/MODIFY specific criteria
                replace_keywords = ['instead of', 'change', 'replace', 'no i want', "don't want", 'not', 'include', 'exclude']
                is_replace = any(keyword in msg_lower for keyword in replace_keywords)
                
                if is_replace and self.state.criteria:
                    # User wants to MODIFY specific criteria while keeping others
                    existing_criteria_text = "\n".join([
                        f"- {crit.get('type', 'include').upper()}: {crit.get('text', '')}"
                        for crit in self.state.criteria
                    ])
                    
                    feedback = f"""IMPORTANT: The user currently has these criteria:
{existing_criteria_text}

USER'S MODIFICATION REQUEST: {modifications or message}

TASK: Based on the user's request, provide the COMPLETE updated list of criteria.
- If the user says "instead of X i want Y", replace X with Y but KEEP all other criteria
- If the user says "no i want X" or "change to X", intelligently determine what to replace with X based on context
- PRESERVE all criteria that are not being modified
- Return ALL criteria in the final list (both modified and unchanged ones)

Example 1:
Current: ["are female", "are asian"]
User says: "instead of female i want male"
Result: ["are male", "are asian"]

Example 2:
Current: ["are female", "are asian", "have diabetes"]
User says: "no i want male"
Result: ["are male", "are asian", "have diabetes"]  (only gender changed)

Example 3:
Current: ["are female", "are asian"]
User says: "change asian to caucasian"
Result: ["are female", "are caucasian"]"""
                    
                    result = self.agent.process_stage_0("", feedback=feedback)
                    new_criteria = result.get('criteria', [])
                    
                    logger.info(f"Replace operation: old count={len(self.state.criteria)}, new count={len(new_criteria)}")
                    
                    # Assign IDs to new criteria
                    for idx, crit in enumerate(new_criteria):
                        crit['id'] = f"c{idx}"
                    
                    self.state.criteria = new_criteria
                    
                    return {
                        'response_text': "I've updated the criteria based on your feedback:",
                        'ui_components': {
                            'type': 'criteria_chips',
                            'data': self.state.criteria
                        },
                        'stage': 0,
                        'metadata': {
                            'stage': 0,
                            'criteria': self.state.criteria,
                            'status': 'Criteria updated',
                            'actions': ['approve', 'edit', 'add_criterion']
                        },
                        'next_prompt': "Do these look better? Say 'yes' to proceed or make more changes."
                    }
                else:
                    # User wants to start over with completely new criteria
                    feedback = modifications or message
                    result = self.agent.process_stage_0("", feedback=feedback)

                    self.state.criteria = result.get('criteria', [])

            return {
                'response_text': "I've updated the criteria based on your feedback:",
                'ui_components': {
                    'type': 'criteria_chips',
                    'data': result.get('criteria', [])
                },
                'stage': 0,
                'metadata': result,
                'next_prompt': "Do these look better? Say 'yes' to proceed."
            }

        
        elif self.state.current_stage == 1:
            # Modify schema-mapped criteria
            # Go back to stage 0, re-extract with feedback, then re-map
            feedback = modifications or message
            
            # Re-extract criteria with feedback
            stage0_result = self.agent.process_stage_0("", feedback=feedback)
            updated_criteria = stage0_result.get('criteria', [])
            
            # Re-map to schema
            result = self.agent.process_stage_1(updated_criteria)
            
            self.state.criteria = result.get('criteria', [])
            self.state.current_stage = 1
            
            return {
                'response_text': "I've updated the criteria based on your feedback:",
                'ui_components': {
                    'type': 'criteria_form',
                    'data': result.get('criteria', [])
                },
                'stage': 1,
                'metadata': result,
                'next_prompt': "Ready to generate SQL?"
            }
        
        elif self.state.current_stage >= 2:
            # For SQL stage and beyond, go back to stage 0 for criteria editing
            self.state.current_stage = 0
            
            # Process the edit at stage 0
            # Check if this is a deletion request
            msg_lower = message.lower().strip()
            delete_keywords = ['remove', 'delete', 'drop', 'take out', 'get rid of']
            is_delete = any(keyword in msg_lower for keyword in delete_keywords)
            
            if is_delete:
                # Handle deletion
                for keyword in delete_keywords:
                    if keyword in msg_lower:
                        delete_text = msg_lower.split(keyword, 1)[1].strip()
                        break
                
                updated_criteria = []
                removed = False
                for crit in self.state.criteria:
                    crit_text = crit.get('text', '').lower()
                    crit_label = crit.get('chip', {}).get('label', '').lower()
                    
                    if delete_text not in crit_text and delete_text not in crit_label:
                        updated_criteria.append(crit)
                    else:
                        removed = True
                        logger.info(f"Removing criterion: {crit.get('text')}")
                
                self.state.criteria = updated_criteria
                
                response_text = f"I've removed the criterion matching '{delete_text}'." if removed else f"I couldn't find a criterion matching '{delete_text}' to remove."
                
                return {
                    'response_text': response_text,
                    'ui_components': {
                        'type': 'criteria_chips',
                        'data': updated_criteria
                    },
                    'stage': 0,
                    'metadata': {
                        'stage': 0,
                        'criteria': updated_criteria,
                        'status': 'Criteria updated',
                        'actions': ['approve', 'edit', 'add_criterion']
                    },
                    'next_prompt': "Do these look better? Say 'yes' to proceed or make more changes."
                }
            
            # Check for add operations
            add_keywords = ['add', 'also', 'and']
            is_add = any(keyword in msg_lower for keyword in add_keywords)
            
            if is_add:
                existing_criteria_text = "\n".join([
                    f"- {crit.get('type', 'include').upper()}: {crit.get('text', '')}"
                    for crit in self.state.criteria
                ])
                
                feedback = f"""IMPORTANT: The user already has these criteria:
{existing_criteria_text}

USER'S NEW REQUEST: {modifications or message}

TASK: Extract ONLY the NEW criteria mentioned in the user's request above.
Do NOT include any of the existing criteria listed above.
Only extract what is NEW in the user's request."""
                
                result = self.agent.process_stage_0("", feedback=feedback)
                new_criteria = result.get('criteria', [])
                
                next_id = len(self.state.criteria)
                for idx, crit in enumerate(new_criteria):
                    crit['id'] = f"c{next_id + idx}"
                
                self.state.criteria.extend(new_criteria)
                
                return {
                    'response_text': f"I've added {len(new_criteria)} new criterion/criteria:",
                    'ui_components': {
                        'type': 'criteria_chips',
                        'data': self.state.criteria
                    },
                    'stage': 0,
                    'metadata': {
                        'stage': 0,
                        'criteria': self.state.criteria,
                        'status': 'Criteria updated',
                        'actions': ['approve', 'edit', 'add_criterion']
                    },
                    'next_prompt': "Do these look good? Say 'yes' to proceed or make more changes."
                }
            
            # Check for replace operations
            replace_keywords = ['instead of', 'change', 'replace', 'no i want', "don't want", 'not', 'include', 'exclude']
            is_replace = any(keyword in msg_lower for keyword in replace_keywords)
            
            if is_replace:
                existing_criteria_text = "\n".join([
                    f"- {crit.get('type', 'include').upper()}: {crit.get('text', '')}"
                    for crit in self.state.criteria
                ])
                
                feedback = f"""IMPORTANT: The user currently has these criteria:
{existing_criteria_text}

USER'S MODIFICATION REQUEST: {modifications or message}

TASK: Based on the user's request, provide the COMPLETE updated list of criteria.
Return ALL criteria in the final list (both modified and unchanged ones)."""
                
                result = self.agent.process_stage_0("", feedback=feedback)
                new_criteria = result.get('criteria', [])
                
                # Deduplicate: Remove contradictory criteria (same text, different type)
                seen_texts = {}
                deduplicated = []
                for crit in new_criteria:
                    text_normalized = crit.get('text', '').lower().strip()
                    crit_type = crit.get('type', 'include')
                    
                    if text_normalized in seen_texts:
                        # Duplicate found - keep the newer one (prefer include over exclude)
                        prev_crit = seen_texts[text_normalized]
                        if crit_type == 'include':
                            # Replace previous with current (include wins)
                            deduplicated = [c for c in deduplicated if c.get('text', '').lower().strip() != text_normalized]
                            deduplicated.append(crit)
                            seen_texts[text_normalized] = crit
                        # else: keep previous, skip current
                    else:
                        deduplicated.append(crit)
                        seen_texts[text_normalized] = crit
                
                # Assign IDs
                for idx, crit in enumerate(deduplicated):
                    crit['id'] = f"c{idx}"
                
                self.state.criteria = deduplicated
                
                return {
                    'response_text': "I've updated the criteria based on your feedback:",
                    'ui_components': {
                        'type': 'criteria_chips',
                        'data': self.state.criteria
                    },
                    'stage': 0,
                    'metadata': {
                        'stage': 0,
                        'criteria': self.state.criteria,
                        'status': 'Criteria updated',
                        'actions': ['approve', 'edit', 'add_criterion']
                    },
                    'next_prompt': "Do these look better? Say 'yes' to proceed or make more changes."
                }
            
            # Default: treat as new criteria extraction
            result = self.agent.process_stage_0("", feedback=modifications or message)
            new_criteria = result.get('criteria', [])
            
            # Deduplicate: Remove contradictory criteria
            seen_texts = {}
            deduplicated = []
            for crit in new_criteria:
                text_normalized = crit.get('text', '').lower().strip()
                crit_type = crit.get('type', 'include')
                
                if text_normalized in seen_texts:
                    prev_crit = seen_texts[text_normalized]
                    if crit_type == 'include':
                        deduplicated = [c for c in deduplicated if c.get('text', '').lower().strip() != text_normalized]
                        deduplicated.append(crit)
                        seen_texts[text_normalized] = crit
                else:
                    deduplicated.append(crit)
                    seen_texts[text_normalized] = crit
            
            self.state.criteria = deduplicated
            
            return {
                'response_text': "I've updated the criteria based on your feedback:",
                'ui_components': {
                    'type': 'criteria_chips',
                    'data': self.state.criteria
                },
                'stage': 0,
                'metadata': {
                    'stage': 0,
                    'criteria': self.state.criteria,
                    'status': 'Criteria updated',
                    'actions': ['approve', 'edit', 'add_criterion']
                },
                'next_prompt': "Do these look better? Say 'yes' to proceed or make more changes."
            }
        
        else:
            return self._provide_guidance()
    
    def _handle_reject(self, message: str) -> Dict[str, Any]:
        """Handle greetings and irrelevant input"""
        logger.info(f"Rejecting non-cohort input: {message}")
        
        # Check if it's a greeting
        greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
        if any(greeting in message.lower() for greeting in greetings):
            response_text = "Hello! I'm here to help you build patient cohorts. To get started, describe the type of patients you're looking for."
        else:
            response_text = "I can help you build patient cohorts based on clinical criteria. Please describe the patients you want to find (e.g., 'Find female patients with breast cancer aged 50-70')."
        
        return {
            'response_text': response_text,
            'stage': self.state.current_stage,
            'metadata': {},
            'next_prompt': "Example: 'Show me patients with diabetes and hypertension' or 'Find male patients over 60 with lung cancer'"
        }
    

    def _handle_undo(self) -> Dict[str, Any]:
        """Undo last modification and restore previous state"""
        logger.info("Handling undo request")
        
        if not self.state.last_state:
            return {
                'response_text': "Nothing to undo. This is the initial state.",
                'stage': self.state.current_stage,
                'metadata': {},
                'next_prompt': "Continue editing criteria or say 'yes' to proceed."
            }
        
        # Restore previous state
        saved_state = self.state.last_state
        self.state.current_stage = saved_state.get('current_stage', 0)
        self.state.criteria = saved_state.get('criteria', [])
        self.state.entities_extracted = saved_state.get('entities_extracted', False)
        self.state.schema_mapped = saved_state.get('schema_mapped', False)
        self.state.concepts_mapped = saved_state.get('concepts_mapped', False)
        self.state.criteria_rewritten = saved_state.get('criteria_rewritten', False)
        self.state.criteria_validated = saved_state.get('criteria_validated', False)
        self.state.sql_query = saved_state.get('sql_query')
        self.state.last_state = None  # Clear undo history (single-level undo)
        
        return {
            'response_text': "Reverted to previous state.",
            'ui_components': {
                'type': 'criteria_chips' if self.state.current_stage == 0 else 'criteria_form',
                'data': self.state.criteria
            },
            'stage': self.state.current_stage,
            'metadata': {'criteria': self.state.criteria},
            'next_prompt': "Continue editing or say 'yes' to proceed."
        }
    def _handle_clarify(self, question: Optional[str]) -> Dict[str, Any]:
        """Ask user for clarification or provide information"""
        
        # If user is asking about current criteria, show them
        if self.state.criteria:
            criteria_summary = []
            for criterion in self.state.criteria:
                crit_type = criterion.get('type', 'include')
                text = criterion.get('text', '')
                criteria_summary.append(f"- {crit_type.upper()}: {text}")
            
            criteria_text = "\n".join(criteria_summary)
            
            return {
                'response_text': f"Here are your current criteria:\n{criteria_text}\n\n{question or 'Would you like to modify these or proceed?'}",
                'ui_components': {
                    'type': 'criteria_chips' if self.state.current_stage == 0 else 'criteria_form',
                    'data': self.state.criteria
                },
                'stage': self.state.current_stage,
                'metadata': {'criteria': self.state.criteria},
                'next_prompt': "Say 'yes' to proceed, or tell me what to change."
            }
        
        clarifying_question = question or "Could you please clarify what you'd like to do?"
        
        return {
            'response_text': clarifying_question,
            'stage': self.state.current_stage,
            'metadata': {},
            'next_prompt': "Please provide more details."
        }
    
    def _handle_db_question(self, message: str) -> Dict[str, Any]:
        """Handle questions about the database schema and available data"""
        try:
            # Get schema information from the agent
            schema_info = self.agent.get_schema_summary()
            
            # Use LLM to answer the specific question with schema context
            prompt = f"""You are a helpful assistant answering questions about a medical research database.

USER QUESTION: {message}

DATABASE SCHEMA INFORMATION:
{schema_info}

Provide a clear, concise answer to the user's question about the database. Focus on:
- Available tables and their purpose
- Key fields and what they contain
- Data types and examples
- How tables relate to each other

Keep the response conversational and helpful."""

            response_text = self.agent._call_llm(
                user_prompt=prompt,
                system_prompt="You are a database expert helping users understand the available data."
            )
            
            return {
                'response_text': response_text,
                'ui_components': {
                    'type': 'info',
                    'data': {
                        'message': 'Database schema information',
                        'schema_available': True
                    }
                },
                'stage': self.state.current_stage,
                'metadata': {},
                'next_prompt': "Is there anything else you'd like to know about the database, or would you like to start building a cohort query?"
            }
            
        except Exception as e:
            logger.error(f"Error handling database question: {e}")
            return {
                'response_text': f"I can help you understand the database structure. This database contains medical research data with information about patients, diagnoses, treatments, and outcomes. What specific aspect would you like to know more about?",
                'ui_components': {
                    'type': 'info',
                    'data': {
                        'message': 'Database information available',
                        'error': str(e)
                    }
                },
                'stage': self.state.current_stage,
                'metadata': {},
                'next_prompt': "Ask me about specific tables, fields, or start building your cohort query."
            }
    
    def _provide_guidance(self) -> Dict[str, Any]:
        """Provide helpful guidance based on current state"""
        if self.state.current_stage == 0 and not self.state.criteria:
            guidance = "Please describe the cohort you'd like to build. For example: 'Find female patients with breast cancer aged 50-70'"
        elif self.state.current_stage == 0:
            guidance = "I've extracted some criteria. Do they look correct? Say 'yes' to proceed or ask me to modify them."
        elif self.state.current_stage == 1:
            guidance = "Please adjust the criteria values using the controls, then say 'generate SQL' when ready."
        elif self.state.current_stage == 2:
            guidance = "I've generated SQL. Would you like me to execute it?"
        elif self.state.current_stage == 3:
            guidance = "Query executed! You can download results or start a new query."
        else:
            guidance = "I'm here to help you build cohorts. What would you like to do?"
        
        return {
            'response_text': guidance,
            'stage': self.state.current_stage,
            'metadata': {}
        }
    
    def _handle_field_mapping_update(self, field_mappings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Handle updated field mappings from the UI (left panel filters).
        Converts field mappings to criteria and updates agent state.
        
        Args:
            field_mappings: List of field mapping dictionaries from database
            
        Returns:
            Response dict with updated criteria
        """
        logger.info(f"Processing field mapping update with {len(field_mappings)} mappings")
        
        try:
            # Convert field mappings to criteria format
            new_criteria = []
            for mapping in field_mappings:
                table_name = mapping.get('table_name')
                field_name = mapping.get('field_name')
                field_type = mapping.get('field_type', 'object')
                concept = mapping.get('concept', f"{field_name} filter")
                operator = mapping.get('operator', '=')
                value = mapping.get('value')
                sql_criterion = mapping.get('sql_criterion', '')
                display_text = mapping.get('display_text', concept)
                
                if not table_name or not field_name:
                    continue
                
                # Create criterion from field mapping
                table_field = f"{table_name}.{field_name}"
                entity_key = field_name.lower().replace('_', ' ')
                
                # Determine mapped concept value
                if isinstance(value, list):
                    mapped_concept = value
                elif isinstance(value, dict) and 'min' in value and 'max' in value:
                    mapped_concept = f"{value['min']}-{value['max']}"
                else:
                    mapped_concept = str(value) if value is not None else ''
                
                criterion = {
                    'text': display_text,
                    'type': 'filter',
                    'entities': [entity_key],
                    'db_mappings': {
                        entity_key: {
                            'entity_class': 'attribute',
                            'table.field': table_field,
                            'ranked_matches': [mapped_concept] if not isinstance(mapped_concept, list) else mapped_concept,
                            'mapped_concept': mapped_concept,
                            'mapping_method': 'user_filter',
                            'field_data_type': field_type,
                            'current_value': value,
                            'current_operator': operator,
                        }
                    },
                    'revised_criterion': sql_criterion,
                    'enabled': True,
                    'source': mapping.get('source', 'user'),
                }
                new_criteria.append(criterion)
            
            # Update agent state with new criteria
            if new_criteria:
                # Merge with existing criteria or replace if user filters are being applied
                # For now, we'll replace user-created filters but keep agent-created ones
                existing_agent_criteria = [c for c in self.state.criteria if c.get('source') != 'user']
                self.state.criteria = existing_agent_criteria + new_criteria
                self.state.schema_mapped = True
                self.state.concepts_mapped = True
                
                logger.info(f"Updated criteria with {len(new_criteria)} field mappings. Total criteria: {len(self.state.criteria)}")
            
            return {
                'response_text': f'Applied {len(new_criteria)} filter(s) to the criteria. The query has been updated.',
                'ui_components': [],
                'stage': self.state.current_stage,
                'metadata': {
                    'criteria': self.state.criteria,
                    'stage': self.state.current_stage,
                    'filters_applied': len(new_criteria),
                    'status': 'Filters applied successfully'
                }
            }
        except Exception as e:
            logger.error(f"Error processing field mapping update: {e}", exc_info=True)
            return {
                'response_text': f'Applied filters, but encountered an error: {str(e)}',
                'ui_components': [],
                'stage': self.state.current_stage,
                'metadata': {
                    'criteria': self.state.criteria,
                    'stage': self.state.current_stage,
                    'error': str(e)
                }
            }
    
    def get_field_mappings_from_db(self) -> List[Dict[str, Any]]:
        """
        Retrieve field mappings from database for this project.
        Used to pre-populate agent state with user-created filters.
        
        Returns:
            List of field mapping dictionaries
        """
        from api.models import FieldMapping
        
        try:
            mappings = FieldMapping.objects.filter(
                cohort_project_id=self.project_id
            ).order_by('-created_at')
            
            return [m.to_filter_dict() for m in mappings]
        except Exception as e:
            logger.error(f"Error retrieving field mappings: {e}", exc_info=True)
            return []
    
    def save_field_mapping_to_db(
        self,
        table_name: str,
        field_name: str,
        field_type: str,
        concept: str,
        operator: str,
        value: Any,
        sql_criterion: str,
        display_text: str,
        source: str = 'agent',
        status: str = 'agent_confirmed'
    ) -> Optional[str]:
        """
        Save a field mapping to database when agent finalizes a concept/field.
        
        Args:
            table_name: Database table name
            field_name: Field name in table
            field_type: Data type of field
            concept: Human-readable concept
            operator: SQL operator (=, IN, BETWEEN, etc.)
            value: Filter value(s)
            sql_criterion: SQL WHERE clause fragment
            display_text: Display text for UI
            source: Source of mapping ('agent', 'user', 'imported')
            status: Status ('draft', 'pending_agent', 'agent_confirmed', 'applied')
            
        Returns:
            UUID of created mapping, or None on error
        """
        from api.models import FieldMapping, CohortProject
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        try:
            project = CohortProject.objects.get(id=self.project_id)
            user = User.objects.get(id=self.user_id)
            
            mapping = FieldMapping.objects.create(
                cohort_project=project,
                user=user,
                source=source,
                status=status,
                table_name=table_name,
                field_name=field_name,
                field_type=field_type,
                concept=concept,
                operator=operator,
                value=value,
                sql_criterion=sql_criterion,
                display_text=display_text,
                agent_metadata={
                    'stage': self.state.current_stage,
                    'confidence': 'high'
                }
            )
            
            logger.info(f"Saved field mapping {mapping.id}: {display_text}")
            return str(mapping.id)
        except Exception as e:
            logger.error(f"Error saving field mapping: {e}", exc_info=True)
            return None
    
    def sync_criteria_with_field_mappings(self):
        """
        Sync current criteria state with field mappings in database.
        Called after agent finalizes concepts/fields before SQL generation.
        """
        if not self.state.criteria:
            return
        
        for criterion in self.state.criteria:
            revised_criterion = criterion.get('revised_criterion', '')
            if not revised_criterion:
                continue
            
            # Parse the criterion to extract table.field, operator, and value
            for entity, mapping in criterion.get('db_mappings', {}).items():
                table_field = mapping.get('table.field', '')
                if not table_field or '.' not in table_field:
                    continue
                
                table_name, field_name = table_field.split('.', 1)
                mapped_concept = mapping.get('mapped_concept', entity)
                
                # Determine operator and value from revised_criterion
                operator = '='
                value = mapped_concept
                
                if 'IN (' in revised_criterion:
                    operator = 'IN'
                    # Extract values from IN clause
                    import re
                    match = re.search(r'IN\s*\((.*?)\)', revised_criterion)
                    if match:
                        value = [v.strip().strip("'\"") for v in match.group(1).split(',')]
                elif 'BETWEEN' in revised_criterion:
                    operator = 'BETWEEN'
                    match = re.search(r'BETWEEN\s+(\S+)\s+AND\s+(\S+)', revised_criterion)
                    if match:
                        value = {'min': match.group(1), 'max': match.group(2)}
                elif '>=' in revised_criterion:
                    operator = '>='
                    match = re.search(r'>=\s*(\S+)', revised_criterion)
                    if match:
                        value = match.group(1)
                elif '<=' in revised_criterion:
                    operator = '<='
                    match = re.search(r'<=\s*(\S+)', revised_criterion)
                    if match:
                        value = match.group(1)
                
                # Save to database
                self.save_field_mapping_to_db(
                    table_name=table_name,
                    field_name=field_name,
                    field_type=mapping.get('field_data_type', 'object'),
                    concept=criterion.get('text', mapped_concept),
                    operator=operator,
                    value=value,
                    sql_criterion=revised_criterion,
                    display_text=f"{field_name}: {mapped_concept}",
                    source='agent',
                    status='agent_confirmed'
                )

    def cleanup(self):
        """Cleanup resources"""
        if hasattr(self, 'agent'):
            self.agent.cleanup()
